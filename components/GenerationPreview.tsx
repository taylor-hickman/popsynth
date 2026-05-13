"use client";

import { useState } from "react";
import { rowsToCsv } from "@/lib/formatters/csv";
import type { ColumnIR, GeneratedRecords, SchemaIR } from "@/lib/types";
import type { TableStatus, TableStatusMap } from "@/components/GenerateClient";

export function GenerationPreview({
  records,
  schema,
  tableStatuses,
  targetRowCounts,
}: {
  records: GeneratedRecords;
  schema: SchemaIR;
  tableStatuses: TableStatusMap;
  targetRowCounts: Record<string, number>;
}) {
  return (
    <div className="flex flex-col gap-6">
      {schema.tables.map((table) => {
        const rows = records[table.name] ?? [];
        const status: TableStatus = tableStatuses[table.name] ?? "pending";
        const target = targetRowCounts[table.name] ?? 0;
        return (
          <section
            key={table.name}
            className="brutal-border brutal-shadow bg-white"
          >
            <header className="brutal-border border-l-0 border-r-0 border-t-0 bg-accent px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-lg font-bold uppercase tracking-wider">
                {table.name}
              </h3>
              <div className="flex items-center gap-3">
                <TerminalProgress
                  status={status}
                  received={rows.length}
                  target={target}
                />
                <CopyButton
                  format="csv"
                  columns={table.columns}
                  rows={rows}
                  tableName={table.name}
                />
              </div>
            </header>
            <div className="relative max-h-[420px] overflow-auto">
              <table className="w-full text-xs tabular-nums border-collapse">
                <thead className="sticky top-0 z-10 bg-ink text-paper">
                  <tr>
                    <th className="px-2 py-2 text-right font-semibold uppercase whitespace-nowrap w-12 border-r-2 border-paper/30">
                      #
                    </th>
                    {table.columns.map((col) => (
                      <th
                        key={col.name}
                        className="px-3 py-2 text-left font-semibold uppercase whitespace-nowrap"
                      >
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <EmptyBody
                      status={status}
                      tableName={table.name}
                      columnCount={table.columns.length + 1}
                    />
                  ) : (
                    rows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-ink/15 even:bg-paper/30 hover:bg-accent/30 transition-colors"
                      >
                        <td className="px-2 py-1.5 text-right opacity-50 font-bold bg-paper/60 border-r-2 border-ink/30 w-12 whitespace-nowrap">
                          {String(i + 1).padStart(3, "0")}
                        </td>
                        {table.columns.map((col) => (
                          <Cell key={col.name} value={row[col.name]} />
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

const BAR_WIDTH = 16;

function asciiBar(received: number, target: number): string {
  if (target <= 0) return "░".repeat(BAR_WIDTH);
  const ratio = Math.max(0, Math.min(1, received / target));
  const filled = Math.round(ratio * BAR_WIDTH);
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

function BlinkCaret() {
  return (
    <span
      aria-hidden="true"
      className="inline-block align-baseline"
      style={{ animation: "brutal-blink 1s steps(1) infinite" }}
    >
      ▮
    </span>
  );
}

function TerminalProgress({
  status,
  received,
  target,
}: {
  status: TableStatus;
  received: number;
  target: number;
}) {
  const base =
    "font-mono text-[11px] tracking-tight whitespace-nowrap leading-none";

  if (status === "complete") {
    return (
      <span className={base}>
        <span className="opacity-60">&gt;</span> ok ▸ {received}/{target}
      </span>
    );
  }
  if (status === "streaming") {
    return (
      <span className={base}>
        <span className="opacity-60">&gt;</span> stream ▸ [{received}/{target}]{" "}
        <span className="font-bold">{asciiBar(received, target)}</span>
        <BlinkCaret />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className={`${base} text-hot font-bold`}>
        <span className="opacity-80">&gt;</span> failed ✕ [{received}/{target}]
      </span>
    );
  }
  return (
    <span className={base}>
      <span className="opacity-60">&gt;</span> awaiting upstream{" "}
      <BlinkCaret />
    </span>
  );
}

function EmptyBody({
  status,
  tableName,
  columnCount,
}: {
  status: TableStatus;
  tableName: string;
  columnCount: number;
}) {
  if (status === "complete") {
    return (
      <tr>
        <td
          className="px-3 py-4 text-center italic opacity-60"
          colSpan={columnCount}
        >
          No rows generated.
        </td>
      </tr>
    );
  }
  if (status === "failed") {
    return (
      <tr>
        <td colSpan={columnCount} className="px-4 py-6">
          <pre className="font-mono text-xs leading-snug m-0 whitespace-pre-wrap break-words text-hot font-bold">
            <span className="opacity-80">$ </span>
            {tableName}.stream → aborted before first batch
          </pre>
        </td>
      </tr>
    );
  }
  const line =
    status === "pending"
      ? `${tableName}.stream → blocked: waiting on upstream tables`
      : `${tableName}.stream → standby for first batch`;
  return (
    <tr>
      <td colSpan={columnCount} className="px-4 py-6">
        <pre className="font-mono text-xs leading-snug m-0 whitespace-pre-wrap break-words">
          <span className="opacity-50">$ </span>
          {line}
          <BlinkCaret />
        </pre>
      </td>
    </tr>
  );
}

function Cell({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return (
      <td className="px-3 py-1.5 align-top whitespace-nowrap">
        <span className="opacity-50 italic">null</span>
      </td>
    );
  }
  if (typeof value === "boolean") {
    return (
      <td className="px-3 py-1.5 align-top whitespace-nowrap">
        <span
          className={
            value
              ? "inline-block px-1.5 py-0.5 text-[10px] uppercase font-bold border border-ink bg-accent"
              : "inline-block px-1.5 py-0.5 text-[10px] uppercase font-bold border border-ink bg-paper"
          }
        >
          {String(value)}
        </span>
      </td>
    );
  }
  if (typeof value === "number") {
    return (
      <td className="px-3 py-1.5 align-top whitespace-nowrap text-right text-cool font-bold">
        {value}
      </td>
    );
  }
  if (typeof value === "string") {
    return (
      <td
        className="px-3 py-1.5 align-top max-w-[20rem] truncate"
        title={value}
      >
        {value}
      </td>
    );
  }
  const stringified = JSON.stringify(value);
  return (
    <td
      className="px-3 py-1.5 align-top max-w-[20rem] truncate italic"
      title={stringified}
    >
      {stringified}
    </td>
  );
}

type CopyFormat = "csv";

function CopyButton({
  format,
  columns,
  rows,
  tableName,
}: {
  format: CopyFormat;
  columns: ColumnIR[];
  rows: Record<string, unknown>[];
  tableName: string;
}) {
  const [copied, setCopied] = useState(false);
  const disabled = rows.length === 0;

  async function onClick() {
    const text = serializers[format](columns, rows);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Copy ${tableName} as ${format.toUpperCase()}`}
      className="brutal-border bg-paper px-2 py-1 text-[10px] uppercase tracking-widest font-bold hover:bg-ink hover:text-paper transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {copied ? "Copied" : `Copy ${format.toUpperCase()}`}
    </button>
  );
}

const serializers: Record<
  CopyFormat,
  (columns: ColumnIR[], rows: Record<string, unknown>[]) => string
> = {
  csv: rowsToCsv,
};
