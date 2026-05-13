import nodeSqlParser from "node-sql-parser";
import { DB_IDENTIFIER_RE, LIMITS } from "../limits";
import type { ColumnIR, ForeignKeyIR, SchemaIR, TableIR } from "../types";

const { Parser } = nodeSqlParser;
const PARSER = new Parser();
const DEFAULT_DIALECT = "PostgreSQL";

export class SqlParseError extends Error {
  readonly cause: unknown;
  constructor(message: string, cause: unknown) {
    super(message);
    this.cause = cause;
  }
}

export function parseSqlDdl(
  sql: string,
  dialect: string = DEFAULT_DIALECT,
): SchemaIR {
  const trimmed = sql.trim();
  if (trimmed.length === 0) {
    throw new SqlParseError("Schema input is empty", null);
  }
  if (trimmed.length > LIMITS.maxSchemaChars) {
    throw new SqlParseError(
      `Schema input is too large. Limit is ${LIMITS.maxSchemaChars} characters.`,
      null,
    );
  }

  let raw: unknown;
  try {
    raw = PARSER.astify(trimmed, { database: dialect });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new SqlParseError(`Could not parse SQL: ${detail}`, err);
  }
  const statements = Array.isArray(raw) ? raw : [raw];

  const tables: TableIR[] = [];
  for (const stmt of statements) {
    if (!isCreateTableStatement(stmt)) {
      throw new SqlParseError(
        "Only CREATE TABLE statements are supported in schema input.",
        null,
      );
    }
    const table = extractTable(stmt);
    if (table) tables.push(table);
  }
  if (tables.length === 0) {
    throw new SqlParseError(
      "No CREATE TABLE statements found in the input",
      null,
    );
  }
  if (tables.length > LIMITS.maxTables) {
    throw new SqlParseError(
      `Schema has ${tables.length} tables. Limit is ${LIMITS.maxTables}.`,
      null,
    );
  }
  return { tables };
}

function isCreateTableStatement(stmt: unknown): boolean {
  return (
    isObject(stmt) &&
    stmt.type === "create" &&
    stmt.keyword === "table"
  );
}

function extractTable(stmt: unknown): TableIR | null {
  if (!isObject(stmt)) return null;
  if (stmt.type !== "create" || stmt.keyword !== "table") return null;

  const tableName = pickTableName(stmt.table);
  if (!tableName) return null;
  assertSimpleIdentifier(tableName, "table");

  const columns: ColumnIR[] = [];
  const foreignKeys: ForeignKeyIR[] = [];
  const defs = Array.isArray(stmt.create_definitions)
    ? stmt.create_definitions
    : [];

  for (const def of defs) {
    if (!isObject(def)) continue;
    if (def.resource === "column") {
      const col = extractColumn(def);
      if (col) columns.push(col);
      const fk = extractInlineForeignKey(def, col?.name);
      if (fk) foreignKeys.push(fk);
    }
  }

  for (const def of defs) {
    if (!isObject(def)) continue;
    if (def.resource !== "constraint") continue;
    applyConstraint(def, columns, foreignKeys, tableName);
  }

  if (columns.length === 0) {
    throw new SqlParseError(
      `Table "${tableName}" has no column definitions`,
      null,
    );
  }
  if (columns.length > LIMITS.maxColumnsPerTable) {
    throw new SqlParseError(
      `Table "${tableName}" has ${columns.length} columns. Limit is ${LIMITS.maxColumnsPerTable}.`,
      null,
    );
  }

  return { name: tableName, columns, foreignKeys };
}

function extractColumn(def: Record<string, unknown>): ColumnIR | null {
  const name = pickColumnName(def.column);
  if (!name) return null;
  assertSimpleIdentifier(name, "column");

  const dt = def.definition;
  const typeStr = pickTypeString(dt);

  const nullable = pickNullable(def);
  // The dialects don't agree: MySQL uses `primary`, PostgreSQL uses `primary_key`.
  const primaryHint = def.primary_key ?? def.primary;
  const isPrimaryKey =
    primaryHint === "primary key" || primaryHint === "key";
  const isUnique =
    def.unique === "unique" ||
    def.unique === "unique key" ||
    def.unique_key === "unique key" ||
    def.unique_key === "unique";

  return {
    name,
    type: typeStr,
    nullable: isPrimaryKey ? false : nullable,
    isPrimaryKey,
    isUnique: isUnique || isPrimaryKey,
    enumValues: null,
  };
}

function extractInlineForeignKey(
  def: Record<string, unknown>,
  columnName: string | undefined,
): ForeignKeyIR | null {
  if (!columnName) return null;
  assertSimpleIdentifier(columnName, "column");
  const ref = def.reference_definition;
  if (!isObject(ref)) return null;
  const refTable = pickTableName(ref.table);
  if (!refTable) return null;
  assertSimpleIdentifier(refTable, "referenced table");
  const refColumn = pickFirstColumnName(ref.definition);
  if (!refColumn) return null;
  assertSimpleIdentifier(refColumn, "referenced column");
  return { column: columnName, refTable, refColumn };
}

function applyConstraint(
  def: Record<string, unknown>,
  columns: ColumnIR[],
  foreignKeys: ForeignKeyIR[],
  tableName: string,
): void {
  const ctype = String(def.constraint_type ?? "").toLowerCase();
  const colNames = pickColumnRefNames(def.definition);

  if (ctype === "primary key") {
    for (const name of colNames) {
      const col = columns.find((c) => c.name === name);
      if (col) {
        col.isPrimaryKey = true;
        col.isUnique = true;
        col.nullable = false;
      }
    }
    return;
  }
  if (ctype === "unique" || ctype === "unique key" || ctype === "unique index") {
    for (const name of colNames) {
      const col = columns.find((c) => c.name === name);
      if (col) col.isUnique = true;
    }
    return;
  }
  if (ctype === "foreign key") {
    const ref = def.reference_definition;
    if (!isObject(ref)) return;
    const refTable = pickTableName(ref.table);
    const refCols = pickColumnRefNames(ref.definition);
    if (!refTable || colNames.length === 0 || refCols.length === 0) return;
    const pairs = Math.min(colNames.length, refCols.length);
    for (let i = 0; i < pairs; i++) {
      assertSimpleIdentifier(colNames[i], "foreign key column");
      assertSimpleIdentifier(refTable, "referenced table");
      assertSimpleIdentifier(refCols[i], "referenced column");
      foreignKeys.push({
        column: colNames[i],
        refTable,
        refColumn: refCols[i],
      });
    }
    return;
  }
  if (ctype === "check") {
    const enumInfo = tryExtractCheckEnum(def.definition);
    if (enumInfo) {
      const col = columns.find((c) => c.name === enumInfo.column);
      if (col) col.enumValues = enumInfo.values;
    }
    return;
  }
  void tableName;
}

function assertSimpleIdentifier(name: string, kind: string): void {
  if (
    name.length > LIMITS.maxIdentifierChars ||
    !DB_IDENTIFIER_RE.test(name)
  ) {
    throw new SqlParseError(
      `Unsupported ${kind} identifier "${name}". Use letters, numbers, and underscores; start with a letter or underscore; max ${LIMITS.maxIdentifierChars} characters.`,
      null,
    );
  }
}

function tryExtractCheckEnum(
  expr: unknown,
): { column: string; values: string[] } | null {
  // Recognise: CHECK (col IN ('a','b',...))
  const root = unwrapSingleton(expr);
  if (!isObject(root)) return null;
  if (root.type !== "binary_expr") return null;
  if (root.operator !== "IN" && root.operator !== "in") return null;
  const left = root.left;
  const right = root.right;
  if (!isObject(left) || left.type !== "column_ref") return null;
  const column = pickColumnName(left) ?? null;
  if (!column) return null;
  if (!isObject(right)) return null;
  const list = right.value;
  if (!Array.isArray(list)) return null;
  const values: string[] = [];
  for (const item of list) {
    if (!isObject(item)) return null;
    if (typeof item.value !== "string") return null;
    values.push(item.value);
  }
  if (values.length === 0) return null;
  return { column, values };
}

function unwrapSingleton(v: unknown): unknown {
  if (Array.isArray(v) && v.length === 1) return v[0];
  return v;
}

function pickTableName(node: unknown): string | null {
  if (Array.isArray(node)) {
    const first = node[0];
    if (isObject(first) && typeof first.table === "string") return first.table;
    return null;
  }
  if (isObject(node) && typeof node.table === "string") return node.table;
  return null;
}

function pickColumnName(node: unknown): string | undefined {
  if (typeof node === "string") return node;
  if (!isObject(node)) return undefined;
  if (typeof node.column === "string") return node.column;
  if (isObject(node.column) && isObject(node.column.expr)) {
    const v = node.column.expr.value;
    if (typeof v === "string") return v;
  }
  return undefined;
}

function pickFirstColumnName(node: unknown): string | undefined {
  if (Array.isArray(node)) {
    for (const item of node) {
      const name = pickColumnName(item);
      if (name) return name;
    }
    return undefined;
  }
  return pickColumnName(node);
}

function pickColumnRefNames(node: unknown): string[] {
  if (!Array.isArray(node)) return [];
  const out: string[] = [];
  for (const item of node) {
    const name = pickColumnName(item);
    if (name) out.push(name);
  }
  return out;
}

function pickTypeString(node: unknown): string {
  if (!isObject(node)) return "unknown";
  const dt = typeof node.dataType === "string" ? node.dataType : "unknown";
  const length =
    typeof node.length === "number"
      ? `(${node.length}${typeof node.scale === "number" ? `,${node.scale}` : ""})`
      : "";
  const array = node.array === "one" ? "[]" : node.array === "two" ? "[][]" : "";
  return `${dt.toLowerCase()}${length}${array}`;
}

function pickNullable(def: Record<string, unknown>): boolean {
  const nullable = def.nullable;
  if (!isObject(nullable)) return true;
  if (nullable.type === "not null") return false;
  return true;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
