import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { Flags } from "@oclif/core";
import {
  GenerationPlan,
  LIMITS,
  RowCounts,
  SchemaIR,
  clampRowCount,
  normalizeRowCounts,
  type ParseSchemaRequest,
  type SchemaInputKind,
  type SchemaIR as SchemaIRType,
  type GenerationPlan as GenerationPlanType,
} from "../core/index";

export const schemaKindFlag = Flags.string({
  description: "Schema input kind.",
  options: ["sql", "csv", "json-schema", "dbt"],
  required: true,
});

export const schemaFlag = Flags.string({
  description: "Schema input path, or - for stdin.",
  required: true,
});

export const outFileFlag = Flags.string({
  description: "Write JSON output to this path instead of stdout.",
});

export const commonFlags = {
  json: Flags.boolean({
    description: "Write machine-readable JSON to stdout.",
  }),
  quiet: Flags.boolean({
    char: "q",
    description: "Suppress progress output.",
  }),
  verbose: Flags.boolean({
    description: "Print additional progress details.",
  }),
};

export const plannerModelFlag = Flags.string({
  description: "Planner model override for this run.",
});

export const rowModelFlag = Flags.string({
  description: "Row generation model override for this run.",
});

export const rowsFlag = Flags.integer({
  description: `Row count for every table, 1-${LIMITS.maxRowsPerTable}.`,
});

export const rowOverrideFlag = Flags.string({
  description: "Per-table row count override as table=count. Repeat for multiple tables.",
  multiple: true,
});

export function parseSchemaKind(value: string): SchemaInputKind {
  if (value === "json-schema") return "json_schema";
  if (value === "sql" || value === "csv" || value === "dbt") return value;
  throw new Error(`Unsupported schema kind "${value}"`);
}

export async function readInputText(path: string): Promise<string> {
  if (path !== "-") return readFileSync(path, "utf8");

  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function buildParseRequest(kind: string, input: string): ParseSchemaRequest {
  return {
    kind: parseSchemaKind(kind),
    input,
  };
}

export function writeJsonOutput(value: unknown, outPath: string | undefined): void {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  if (!outPath) {
    process.stdout.write(content);
    return;
  }
  writeTextFile(outPath, content);
}

export function writeTextFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export function readSchemaIr(path: string): SchemaIRType {
  return SchemaIR.parse(JSON.parse(readFileSync(path, "utf8")));
}

export function readGenerationPlan(path: string): GenerationPlanType {
  return GenerationPlan.parse(JSON.parse(readFileSync(path, "utf8")));
}

export function buildRowCounts(
  schema: SchemaIRType,
  rows: number | undefined,
  overrides: string[] | undefined,
): RowCounts {
  const base: Record<string, unknown> = {};
  if (rows !== undefined) {
    for (const table of schema.tables) base[table.name] = rows;
  }
  for (const raw of overrides ?? []) {
    const separator = raw.indexOf("=");
    if (separator <= 0 || separator === raw.length - 1) {
      throw new Error(`Invalid --row value "${raw}". Use table=count.`);
    }
    const table = raw.slice(0, separator);
    const value = raw.slice(separator + 1);
    if (!schema.tables.some((candidate) => candidate.name === table)) {
      throw new Error(`Unknown table in --row override: "${table}"`);
    }
    base[table] = clampRowCount(value);
  }
  return normalizeRowCounts(schema, base);
}

export function ensureAnthropicKey(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
}

export function prepareOutputDirectory(outDir: string, force: boolean): string {
  const resolved = resolve(outDir);
  if (!existsSync(resolved)) {
    mkdirSync(resolved, { recursive: true });
    return resolved;
  }
  if (!statSync(resolved).isDirectory()) {
    throw new Error(`Output path exists and is not a directory: ${resolved}`);
  }
  const entries = readdirSync(resolved).filter((entry) => entry !== ".DS_Store");
  if (entries.length > 0 && !force) {
    throw new Error(
      `Output directory is not empty: ${resolved}. Re-run with --force to write into it.`,
    );
  }
  return resolved;
}

export function outputPath(outDir: string, filename: string): string {
  return join(outDir, filename);
}

export function displayPath(path: string): string {
  return isAbsolute(path) ? path : resolve(path);
}
