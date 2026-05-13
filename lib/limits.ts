import { z } from "zod";
import type { SchemaIR } from "@/lib/types";

export const LIMITS = {
  maxThemeChars: 200,
  maxSchemaChars: 20_000,
  maxTables: 20,
  maxColumnsPerTable: 50,
  maxRowsPerTable: 200,
  defaultRowsPerTable: 10,
  maxIdentifierChars: 63,
} as const;

export const DB_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const RowCount = z.coerce
  .number()
  .int()
  .min(1)
  .max(LIMITS.maxRowsPerTable);

export const RowCounts = z.record(z.string(), RowCount);
export type RowCounts = z.infer<typeof RowCounts>;

export function clampRowCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return LIMITS.defaultRowsPerTable;
  return Math.min(
    LIMITS.maxRowsPerTable,
    Math.max(1, Math.trunc(parsed)),
  );
}

export function defaultRowCounts(schema: SchemaIR): RowCounts {
  return Object.fromEntries(
    schema.tables.map((table) => [table.name, LIMITS.defaultRowsPerTable]),
  );
}

export function normalizeRowCounts(
  schema: SchemaIR,
  rowCounts: Partial<Record<string, unknown>> | null | undefined,
): RowCounts {
  return Object.fromEntries(
    schema.tables.map((table) => [
      table.name,
      clampRowCount(rowCounts?.[table.name]),
    ]),
  );
}

export function sanitizeFileBasename(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9_ -]+/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_") || "table"
  );
}
