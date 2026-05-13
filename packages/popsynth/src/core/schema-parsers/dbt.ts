import yaml from "js-yaml";
import { DB_IDENTIFIER_RE, LIMITS } from "../limits";
import type {
  ColumnIR,
  ForeignKeyIR,
  SchemaIR,
  TableIR,
} from "../types";

const { JSON_SCHEMA, load } = yaml;

export class DbtParseError extends Error {
  readonly cause: unknown;
  constructor(message: string, cause: unknown = null) {
    super(message);
    this.cause = cause;
  }
}

const REF_RE = /^ref\(\s*['"]([^'"]+)['"]\s*\)$/;
const SOURCE_RE = /^source\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]\s*\)$/;

export function parseDbtYaml(input: string): SchemaIR {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new DbtParseError("dbt YAML input is empty");
  }
  if (trimmed.length > LIMITS.maxSchemaChars) {
    throw new DbtParseError(
      `dbt YAML input is too large. Limit is ${LIMITS.maxSchemaChars} characters.`,
    );
  }

  let doc: unknown;
  try {
    doc = load(trimmed, { schema: JSON_SCHEMA });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new DbtParseError(`Could not parse YAML: ${detail}`, err);
  }
  if (!isObject(doc)) {
    throw new DbtParseError("dbt YAML must be a mapping at the top level");
  }

  const tables: TableIR[] = [];
  const seen = new Set<string>();

  for (const source of pickList(doc.sources)) {
    if (!isObject(source)) continue;
    for (const t of pickList(source.tables)) {
      if (!isObject(t)) continue;
      addTable(tables, seen, buildTable(t));
    }
  }
  for (const model of pickList(doc.models)) {
    if (!isObject(model)) continue;
    addTable(tables, seen, buildTable(model));
  }
  for (const seed of pickList(doc.seeds)) {
    if (!isObject(seed)) continue;
    addTable(tables, seen, buildTable(seed));
  }

  if (tables.length === 0) {
    throw new DbtParseError(
      "No sources/models/seeds with column definitions were found",
    );
  }
  if (tables.length > LIMITS.maxTables) {
    throw new DbtParseError(
      `dbt YAML defines ${tables.length} tables. Limit is ${LIMITS.maxTables}.`,
    );
  }
  return { tables };
}

function buildTable(node: Record<string, unknown>): TableIR {
  const rawName = typeof node.name === "string" ? node.name : "";
  if (!rawName) {
    throw new DbtParseError("A dbt entry is missing its 'name' field");
  }
  const name = assertIdentifier(rawName, "table");
  const cols = pickList(node.columns);
  if (cols.length === 0) {
    throw new DbtParseError(
      `dbt entry "${name}" has no 'columns' list`,
    );
  }
  if (cols.length > LIMITS.maxColumnsPerTable) {
    throw new DbtParseError(
      `dbt entry "${name}" has ${cols.length} columns. Limit is ${LIMITS.maxColumnsPerTable}.`,
    );
  }

  const columns: ColumnIR[] = [];
  const foreignKeys: ForeignKeyIR[] = [];

  for (const c of cols) {
    if (!isObject(c)) continue;
    const rawColName = typeof c.name === "string" ? c.name : "";
    if (!rawColName) continue;
    const colName = assertIdentifier(rawColName, "column");
    const dataType =
      typeof c.data_type === "string" && c.data_type.trim().length > 0
        ? c.data_type.trim().toLowerCase()
        : "text";

    let isPrimaryKey = false;
    let isUnique = false;
    let nullable = true;

    for (const constraint of pickList(c.constraints)) {
      if (!isObject(constraint)) continue;
      const ctype = String(constraint.type ?? "").toLowerCase();
      if (ctype === "primary_key" || ctype === "primary key") {
        isPrimaryKey = true;
        isUnique = true;
        nullable = false;
      } else if (ctype === "unique") {
        isUnique = true;
      } else if (ctype === "not_null" || ctype === "not null") {
        nullable = false;
      }
    }

    for (const test of pickList(c.tests)) {
      if (typeof test === "string") {
        if (test === "unique") isUnique = true;
        else if (test === "not_null") nullable = false;
        continue;
      }
      if (!isObject(test)) continue;
      if (test.unique !== undefined) isUnique = true;
      if (test.not_null !== undefined) nullable = false;
      const rel = test.relationships;
      if (isObject(rel)) {
        const fk = extractRelationshipFk(colName, rel);
        if (fk) foreignKeys.push(fk);
      }
    }

    if (isPrimaryKey) nullable = false;

    columns.push({
      name: colName,
      type: dataType,
      nullable,
      isPrimaryKey,
      isUnique,
      enumValues: null,
    });
  }

  if (columns.length === 0) {
    throw new DbtParseError(`dbt entry "${name}" produced no valid columns`);
  }

  return { name, columns, foreignKeys };
}

function extractRelationshipFk(
  column: string,
  rel: Record<string, unknown>,
): ForeignKeyIR | null {
  const to = typeof rel.to === "string" ? rel.to.trim() : "";
  const field = typeof rel.field === "string" ? rel.field.trim() : "";
  if (!to || !field) return null;
  let refTable: string | null = null;
  const refMatch = REF_RE.exec(to);
  if (refMatch) refTable = refMatch[1];
  const srcMatch = SOURCE_RE.exec(to);
  if (!refTable && srcMatch) refTable = srcMatch[1];
  if (!refTable) refTable = to;
  try {
    return {
      column,
      refTable: assertIdentifier(refTable, "referenced table"),
      refColumn: assertIdentifier(field, "referenced column"),
    };
  } catch {
    return null;
  }
}

function addTable(
  tables: TableIR[],
  seen: Set<string>,
  table: TableIR,
): void {
  if (seen.has(table.name)) return;
  seen.add(table.name);
  tables.push(table);
}

function assertIdentifier(raw: string, kind: string): string {
  const candidate = raw.trim();
  if (
    candidate.length === 0 ||
    candidate.length > LIMITS.maxIdentifierChars ||
    !DB_IDENTIFIER_RE.test(candidate)
  ) {
    throw new DbtParseError(
      `Unsupported ${kind} identifier "${raw}". Use letters, numbers, and underscores; start with a letter or underscore; max ${LIMITS.maxIdentifierChars} characters.`,
    );
  }
  return candidate;
}

function pickList(node: unknown): unknown[] {
  return Array.isArray(node) ? node : [];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
