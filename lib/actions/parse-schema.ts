"use server";

import { z } from "zod";
import { parseSqlDdl, SqlParseError } from "@/lib/schema-parsers/sql";
import { parseCsvHeaders, CsvParseError } from "@/lib/schema-parsers/csv";
import {
  parseJsonSchema,
  JsonSchemaParseError,
} from "@/lib/schema-parsers/json-schema";
import { parseDbtYaml, DbtParseError } from "@/lib/schema-parsers/dbt";
import { SchemaIR } from "@/lib/types";

export type SchemaInputKind = "sql" | "csv" | "json_schema" | "dbt";

export type ParseSchemaRequest = {
  kind: SchemaInputKind;
  input: string;
};

export type ParseSchemaResult =
  | { ok: true; schema: SchemaIR }
  | { ok: false; error: string };

export async function parseSchemaAction(
  req: ParseSchemaRequest,
): Promise<ParseSchemaResult> {
  try {
    const raw = await dispatch(req);
    const schema = SchemaIR.parse(raw);
    return { ok: true, schema };
  } catch (err) {
    return { ok: false, error: formatError(err) };
  }
}

async function dispatch(req: ParseSchemaRequest): Promise<SchemaIR> {
  switch (req.kind) {
    case "sql":
      return parseSqlDdl(req.input);
    case "csv":
      return await parseCsvHeaders(req.input);
    case "json_schema":
      return parseJsonSchema(req.input);
    case "dbt":
      return parseDbtYaml(req.input);
  }
}

function formatError(err: unknown): string {
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
