import { z } from "zod";
import { parseSqlDdl, SqlParseError } from "./schema-parsers/sql";
import { parseCsvHeaders, CsvParseError } from "./schema-parsers/csv";
import {
  parseJsonSchema,
  JsonSchemaParseError,
} from "./schema-parsers/json-schema";
import { parseDbtYaml, DbtParseError } from "./schema-parsers/dbt";
import { SchemaIR } from "./types";

export type SchemaInputKind = "sql" | "csv" | "json_schema" | "dbt";

export type ParseSchemaRequest = {
  kind: SchemaInputKind;
  input: string;
};

export type ParseSchemaOptions = {
  plannerModelName?: string;
};

export type ParseSchemaResult =
  | { ok: true; schema: SchemaIR }
  | { ok: false; error: string };

export async function parseSchemaInput(
  req: ParseSchemaRequest,
  options?: ParseSchemaOptions,
): Promise<ParseSchemaResult> {
  try {
    const raw = await dispatch(req, options);
    const schema = SchemaIR.parse(raw);
    return { ok: true, schema };
  } catch (err) {
    return { ok: false, error: formatSchemaParseError(err) };
  }
}

export async function parseSchemaOrThrow(
  req: ParseSchemaRequest,
  options?: ParseSchemaOptions,
): Promise<SchemaIR> {
  const result = await parseSchemaInput(req, options);
  if (!result.ok) throw new Error(result.error);
  return result.schema;
}

async function dispatch(
  req: ParseSchemaRequest,
  options?: ParseSchemaOptions,
): Promise<SchemaIR> {
  switch (req.kind) {
    case "sql":
      return parseSqlDdl(req.input);
    case "csv":
      return await parseCsvHeaders(req.input, {
        plannerModelName: options?.plannerModelName,
      });
    case "json_schema":
      return parseJsonSchema(req.input);
    case "dbt":
      return parseDbtYaml(req.input);
  }
}

export function formatSchemaParseError(err: unknown): string {
  if (
    err instanceof SqlParseError ||
    err instanceof CsvParseError ||
    err instanceof JsonSchemaParseError ||
    err instanceof DbtParseError
  ) {
    return err.message;
  }
  if (err instanceof z.ZodError) {
    return err.issues
      .map(
        (issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`,
      )
      .join("\n");
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
