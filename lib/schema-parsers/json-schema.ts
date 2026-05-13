import { DB_IDENTIFIER_RE, LIMITS } from "@/lib/limits";
import type { ColumnIR, SchemaIR, TableIR } from "@/lib/types";

export class JsonSchemaParseError extends Error {
  readonly cause: unknown;
  constructor(message: string, cause: unknown = null) {
    super(message);
    this.cause = cause;
  }
}

export function parseJsonSchema(input: string): SchemaIR {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new JsonSchemaParseError("JSON Schema input is empty");
  }
  if (trimmed.length > LIMITS.maxSchemaChars) {
    throw new JsonSchemaParseError(
      `JSON Schema input is too large. Limit is ${LIMITS.maxSchemaChars} characters.`,
    );
  }

  let doc: unknown;
  try {
    doc = JSON.parse(trimmed);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new JsonSchemaParseError(`Could not parse JSON: ${detail}`, err);
  }

  if (!isObject(doc)) {
    throw new JsonSchemaParseError(
      "JSON Schema must be an object at the top level",
    );
  }

  const tables: TableIR[] = [];
  tables.push(buildTable(doc, fallbackRootName(doc)));

  const defsContainer = pickDefs(doc);
  if (defsContainer) {
    for (const [rawName, def] of Object.entries(defsContainer)) {
      if (!isObject(def)) continue;
      const name = toIdentifier(rawName, "$defs entry");
      tables.push(buildTable(def, name));
    }
  }

  if (tables.length > LIMITS.maxTables) {
    throw new JsonSchemaParseError(
      `Resulting schema has ${tables.length} tables. Limit is ${LIMITS.maxTables}.`,
    );
  }
  return { tables };
}

function buildTable(node: Record<string, unknown>, tableName: string): TableIR {
  const properties = pickProperties(node);
  if (!properties) {
    throw new JsonSchemaParseError(
      `JSON Schema for "${tableName}" has no "properties" object`,
    );
  }
  const required = pickRequired(node);
  const columns: ColumnIR[] = [];
  for (const [rawName, def] of Object.entries(properties)) {
    if (!isObject(def)) continue;
    const name = toIdentifier(rawName, "property");
    columns.push({
      name,
      type: mapType(def),
      nullable: !required.has(rawName),
      isPrimaryKey: false,
      isUnique: false,
      enumValues: pickEnum(def),
    });
  }
  if (columns.length === 0) {
    throw new JsonSchemaParseError(
      `JSON Schema for "${tableName}" has no usable properties`,
    );
  }
  if (columns.length > LIMITS.maxColumnsPerTable) {
    throw new JsonSchemaParseError(
      `Table "${tableName}" has ${columns.length} columns. Limit is ${LIMITS.maxColumnsPerTable}.`,
    );
  }
  return { name: tableName, columns, foreignKeys: [] };
}

function mapType(def: Record<string, unknown>): string {
  const t = pickJsonType(def);
  const format = typeof def.format === "string" ? def.format : null;
  if (t === "integer") return "integer";
  if (t === "number") return "numeric";
  if (t === "boolean") return "boolean";
  if (t === "string") {
    if (format === "date-time") return "timestamp";
    if (format === "date") return "date";
    if (format === "uuid") return "uuid";
    if (format === "email") return "varchar(254)";
    if (format === "uri" || format === "url") return "text";
    return "text";
  }
  if (t === "array" || t === "object") return "jsonb";
  return "text";
}

function pickJsonType(def: Record<string, unknown>): string | null {
  const t = def.type;
  if (typeof t === "string") return t;
  if (Array.isArray(t)) {
    const concrete = t.find((entry) => typeof entry === "string" && entry !== "null");
    if (typeof concrete === "string") return concrete;
  }
  return null;
}

function pickEnum(def: Record<string, unknown>): string[] | null {
  if (!Array.isArray(def.enum)) return null;
  const values: string[] = [];
  for (const item of def.enum) {
    if (typeof item === "string") values.push(item);
    else if (typeof item === "number" || typeof item === "boolean") {
      values.push(String(item));
    }
  }
  return values.length > 0 ? values : null;
}

function pickProperties(
  node: Record<string, unknown>,
): Record<string, unknown> | null {
  const props = node.properties;
  return isObject(props) ? props : null;
}

function pickRequired(node: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  if (Array.isArray(node.required)) {
    for (const entry of node.required) {
      if (typeof entry === "string") out.add(entry);
    }
  }
  return out;
}

function pickDefs(
  node: Record<string, unknown>,
): Record<string, unknown> | null {
  if (isObject(node.$defs)) return node.$defs;
  if (isObject(node.definitions)) return node.definitions;
  return null;
}

function fallbackRootName(node: Record<string, unknown>): string {
  const title = typeof node.title === "string" ? node.title : null;
  if (title) {
    try {
      return toIdentifier(title, "title");
    } catch {
      // fall through to default
    }
  }
  return "record";
}

function toIdentifier(raw: string, kind: string): string {
  let candidate = raw
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (candidate.length === 0) {
    throw new JsonSchemaParseError(
      `Cannot derive identifier for ${kind} from "${raw}"`,
    );
  }
  if (/^[0-9]/.test(candidate)) candidate = `c_${candidate}`;
  if (candidate.length > LIMITS.maxIdentifierChars) {
    candidate = candidate.slice(0, LIMITS.maxIdentifierChars);
  }
  if (!DB_IDENTIFIER_RE.test(candidate)) {
    throw new JsonSchemaParseError(
      `Could not normalize ${kind} "${raw}" into a SQL identifier`,
    );
  }
  return candidate;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
