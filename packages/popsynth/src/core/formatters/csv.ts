import Papa from "papaparse";
import { sanitizeFileBasename } from "../limits";
import type { ColumnIR, Formatter } from "../types";

export function rowsToCsv(
  columns: ColumnIR[],
  rows: Record<string, unknown>[],
): string {
  const headers = columns.map((c) => c.name);
  const data = rows.map((row) =>
    headers.map((h) => {
      const v = row[h];
      if (v === null || v === undefined) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return v;
    }),
  );
  return Papa.unparse({ fields: headers, data }, { newline: "\n" });
}

export const csvFormatter: Formatter = (records, schema) => {
  return schema.tables.map((table) => ({
    filename: `${sanitizeFileBasename(table.name)}.csv`,
    content: rowsToCsv(table.columns, records[table.name] ?? []),
  }));
};
