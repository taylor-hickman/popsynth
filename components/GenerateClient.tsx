"use client";

import { useState } from "react";
import {
  LIMITS,
  clampRowCount,
  defaultRowCounts,
  type RowCounts,
} from "popsynth/core";
import type {
  FormatterOutput,
  GeneratedRecords,
  GenerationPlan,
  SchemaIR,
} from "popsynth/core";
import { GenerationPreview } from "@/components/GenerationPreview";
import { DownloadPanel } from "@/components/DownloadPanel";
import { PlanPreview } from "@/components/PlanPreview";

type GenerateResponse = {
  theme: string;
  records: GeneratedRecords;
  files: FormatterOutput[];
};

export type TableStatus = "pending" | "streaming" | "complete" | "failed";
export type TableStatusMap = Record<string, TableStatus>;

type Status =
  | { kind: "idle" }
  | { kind: "planning" }
  | {
      kind: "generating";
      plan: GenerationPlan;
      records: GeneratedRecords;
      tableStatuses: TableStatusMap;
    }
  | {
      kind: "done";
      plan: GenerationPlan;
      result: GenerateResponse;
      tableStatuses: TableStatusMap;
    }
  | { kind: "error"; error: string; plan: GenerationPlan | null };

export function GenerateClient({
  schema,
  theme,
}: {
  schema: SchemaIR | null;
  theme: string;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [rowCounts, setRowCounts] = useState<RowCounts>({});
  const effectiveRowCounts = schema
    ? { ...defaultRowCounts(schema), ...rowCounts }
    : {};

  const disabled =
    !schema ||
    theme.trim().length === 0 ||
    theme.trim().length > LIMITS.maxThemeChars ||
    isInFlight(status);

  async function run() {
    if (!schema) return;
    const normalizedRowCounts = normalizeClientRowCounts(
      schema,
      effectiveRowCounts,
    );
    setStatus({ kind: "planning" });
    let plan: GenerationPlan;
    try {
      plan = await postJson<{ plan: GenerationPlan }>("/api/plan", {
        schema,
        theme,
        rowCounts: normalizedRowCounts,
      }).then((r) => r.plan);
    } catch (e) {
      setStatus({
        kind: "error",
        error: e instanceof Error ? e.message : String(e),
        plan: null,
      });
      return;
    }

    const records: GeneratedRecords = {};
    const tableStatuses: TableStatusMap = Object.fromEntries(
      plan.tables.map((t) => [t.name, "pending" as TableStatus]),
    );
    setStatus({
      kind: "generating",
      plan,
      records,
      tableStatuses: { ...tableStatuses },
    });
    let files: FormatterOutput[] | null = null;
    let resultTheme = plan.theme;

    try {
      await postSse("/api/generate", { schema, plan }, (event, data) => {
        if (event === "table-start") {
          const e = TableLifecycleEvent.parse(data);
          tableStatuses[e.table] = "streaming";
          setStatus({
            kind: "generating",
            plan,
            records: cloneRecords(records),
            tableStatuses: { ...tableStatuses },
          });
          return;
        }
        if (event === "table-complete") {
          const e = TableLifecycleEvent.parse(data);
          tableStatuses[e.table] = "complete";
          setStatus({
            kind: "generating",
            plan,
            records: cloneRecords(records),
            tableStatuses: { ...tableStatuses },
          });
          return;
        }
        if (event === "table-failed") {
          const e = TableLifecycleEvent.parse(data);
          tableStatuses[e.table] = "failed";
          setStatus({
            kind: "generating",
            plan,
            records: cloneRecords(records),
            tableStatuses: { ...tableStatuses },
          });
          return;
        }
        if (event === "rows") {
          const rowEvent = RowsEvent.parse(data);
          records[rowEvent.table] = [
            ...(records[rowEvent.table] ?? []),
            ...rowEvent.rows,
          ];
          if (tableStatuses[rowEvent.table] === "pending") {
            tableStatuses[rowEvent.table] = "streaming";
          }
          setStatus({
            kind: "generating",
            plan,
            records: cloneRecords(records),
            tableStatuses: { ...tableStatuses },
          });
          return;
        }
        if (event === "files") {
          const filesEvent = FilesEvent.parse(data);
          files = filesEvent.files;
          resultTheme = filesEvent.theme;
          return;
        }
        if (event === "error") {
          const errorEvent = ErrorEvent.parse(data);
          throw new Error(errorEvent.error);
        }
      });
      if (!files) throw new Error("Generation finished without output files.");
      const result: GenerateResponse = {
        theme: resultTheme,
        records: cloneRecords(records),
        files,
      };
      const finalStatuses: TableStatusMap = Object.fromEntries(
        plan.tables.map((t) => [t.name, "complete" as TableStatus]),
      );
      setStatus({ kind: "done", plan, result, tableStatuses: finalStatuses });
    } catch (e) {
      setStatus({
        kind: "error",
        error: e instanceof Error ? e.message : String(e),
        plan,
      });
    }
  }

  const plan = currentPlan(status);
  const result = status.kind === "done" ? status.result : null;
  const previewRecords =
    status.kind === "generating"
      ? status.records
      : status.kind === "done"
        ? status.result.records
        : null;
  const previewStatuses: TableStatusMap | null =
    status.kind === "generating" || status.kind === "done"
      ? status.tableStatuses
      : null;
  const error = status.kind === "error" ? status.error : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="brutal-border brutal-shadow bg-white p-5 flex flex-col gap-3">
        <header className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold uppercase tracking-wider">
            Generate
          </h2>
          <StatusBadge status={status} />
        </header>
        {schema ? (
          <RowCountControls
            schema={schema}
            rowCounts={effectiveRowCounts}
            disabled={isInFlight(status)}
            onChange={(table, value) =>
              setRowCounts((current) => ({
                ...current,
                [table]: clampRowCount(value),
              }))
            }
          />
        ) : null}
        <button
          onClick={run}
          disabled={disabled}
          className="brutal-border bg-accent uppercase font-bold px-4 py-3 tracking-widest text-base hover:bg-hot hover:text-paper disabled:opacity-50 transition-colors self-start"
        >
          {buttonLabel(status)}
        </button>
        {disabled && status.kind === "idle" ? (
          <p className="text-xs opacity-70">
            Parse a schema and enter a theme under {LIMITS.maxThemeChars} characters.
          </p>
        ) : null}
        {error ? (
          <div className="brutal-border bg-hot text-paper p-3 text-sm whitespace-pre-wrap">
            <strong className="uppercase">Error:</strong> {error}
          </div>
        ) : null}
      </div>

      {plan ? <PlanPreview plan={plan} /> : null}

      {result ? (
        <>
          <DownloadPanel
            files={result.files}
            zipName={`${slugify(result.theme)}-dataset.zip`}
          />
        </>
      ) : null}

      {previewRecords && schema ? (
        <GenerationPreview
          records={previewRecords}
          schema={schema}
          tableStatuses={previewStatuses ?? {}}
          targetRowCounts={
            plan
              ? Object.fromEntries(plan.tables.map((t) => [t.name, t.rowCount]))
              : {}
          }
        />
      ) : null}
    </div>
  );
}

function RowCountControls({
  schema,
  rowCounts,
  disabled,
  onChange,
}: {
  schema: SchemaIR;
  rowCounts: RowCounts;
  disabled: boolean;
  onChange: (table: string, value: string) => void;
}) {
  return (
    <div className="brutal-border bg-paper p-3">
      <div className="text-xs uppercase font-bold tracking-wider mb-2">
        Row counts <span className="opacity-60">(1–{LIMITS.maxRowsPerTable})</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {schema.tables.map((table) => (
          <RowCountField
            key={table.name}
            tableName={table.name}
            value={rowCounts[table.name] ?? LIMITS.defaultRowsPerTable}
            disabled={disabled}
            onCommit={(raw) => onChange(table.name, raw)}
          />
        ))}
      </div>
    </div>
  );
}

function RowCountField({
  tableName,
  value,
  disabled,
  onCommit,
}: {
  tableName: string;
  value: number;
  disabled: boolean;
  onCommit: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const clamped = clampRowCount(draft);
    setDraft(String(clamped));
    onCommit(String(clamped));
  }

  return (
    <label className="inline-flex items-center gap-2 text-xs uppercase w-fit">
      <span className="font-bold truncate max-w-[14rem]">{tableName}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, "").slice(0, 3);
          setDraft(next);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            (event.currentTarget as HTMLInputElement).blur();
          }
        }}
        disabled={disabled}
        aria-label={`${tableName} row count`}
        className="brutal-border bg-white px-2 py-1 w-16 font-mono text-right disabled:opacity-60"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const label =
    status.kind === "idle"
      ? "idle"
      : status.kind === "planning"
        ? "1/2 · planning"
        : status.kind === "generating"
          ? "2/2 · generating"
          : status.kind === "done"
            ? "complete"
            : "error";
  return <span className="text-xs uppercase opacity-70">{label}</span>;
}

function buttonLabel(status: Status): string {
  switch (status.kind) {
    case "planning":
      return "Planning…";
    case "generating":
      return "Generating rows…";
    case "done":
      return "Regenerate";
    case "error":
      return "Try again";
    default:
      return "Generate Dataset";
  }
}

function currentPlan(status: Status): GenerationPlan | null {
  switch (status.kind) {
    case "generating":
    case "done":
      return status.plan;
    case "error":
      return status.plan;
    default:
      return null;
  }
}

function isInFlight(status: Status): boolean {
  return status.kind === "planning" || status.kind === "generating";
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(detail.error ?? `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

const TableLifecycleEvent = {
  parse(data: unknown): { table: string } {
    if (!isRecord(data) || typeof data.table !== "string") {
      throw new Error("Invalid table lifecycle event.");
    }
    return { table: data.table };
  },
};

const RowsEvent = {
  parse(data: unknown): { table: string; rows: Record<string, unknown>[] } {
    if (!isRecord(data) || typeof data.table !== "string") {
      throw new Error("Invalid rows event.");
    }
    if (!Array.isArray(data.rows)) throw new Error("Invalid rows event.");
    return {
      table: data.table,
      rows: data.rows.filter(isRecord),
    };
  },
};

const FilesEvent = {
  parse(data: unknown): { theme: string; files: FormatterOutput[] } {
    if (!isRecord(data) || typeof data.theme !== "string") {
      throw new Error("Invalid files event.");
    }
    if (!Array.isArray(data.files)) throw new Error("Invalid files event.");
    return {
      theme: data.theme,
      files: data.files.filter(isFormatterOutput),
    };
  },
};

const ErrorEvent = {
  parse(data: unknown): { error: string } {
    if (!isRecord(data) || typeof data.error !== "string") {
      return { error: "Generation failed." };
    }
    return { error: data.error };
  },
};

async function postSse(
  url: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(detail.error ?? `Request failed: ${res.status}`);
  }
  if (!res.body) throw new Error("Generation response did not include a stream.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      handleSseBlock(block, onEvent);
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim().length > 0) handleSseBlock(buffer, onEvent);
}

function handleSseBlock(
  block: string,
  onEvent: (event: string, data: unknown) => void,
): void {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }

  if (dataLines.length === 0) return;
  onEvent(event, JSON.parse(dataLines.join("\n")));
}

function normalizeClientRowCounts(
  schema: SchemaIR,
  rowCounts: RowCounts,
): RowCounts {
  return Object.fromEntries(
    schema.tables.map((table) => [
      table.name,
      clampRowCount(rowCounts[table.name]),
    ]),
  );
}

function cloneRecords(records: GeneratedRecords): GeneratedRecords {
  return Object.fromEntries(
    Object.entries(records).map(([table, rows]) => [table, [...rows]]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFormatterOutput(value: unknown): value is FormatterOutput {
  return (
    isRecord(value) &&
    typeof value.filename === "string" &&
    typeof value.content === "string"
  );
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "themed"
  );
}
