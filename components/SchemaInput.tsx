"use client";

import { useState, useTransition } from "react";
import { LIMITS } from "popsynth/core";
import {
  parseSchemaAction,
  type SchemaInputKind,
} from "@/lib/actions/parse-schema";
import type { SchemaIR } from "popsynth/core";
import { SchemaPreview } from "@/components/SchemaPreview";
import { SchemaEditor } from "@/components/SchemaEditor";

type ParseState =
  | { kind: "idle" }
  | { kind: "ok"; schema: SchemaIR }
  | { kind: "error"; error: string };

type ModeConfig = {
  id: SchemaInputKind;
  label: string;
  placeholder: string;
  helper: string;
};

const MODES: ModeConfig[] = [
  {
    id: "sql",
    label: "SQL DDL",
    placeholder:
      "CREATE TABLE users (\n  id integer PRIMARY KEY,\n  email varchar(254) UNIQUE NOT NULL,\n  created_at timestamp NOT NULL\n);",
    helper: "PostgreSQL dialect. Only CREATE TABLE statements.",
  },
  {
    id: "csv",
    label: "CSV",
    placeholder:
      "id, email, created_at\n1, ada@example.com, 2025-01-01T09:00:00Z\n2, lin@example.com, 2025-01-02T09:00:00Z",
    helper:
      "First row = headers. Add 1–3 sample rows to improve types. Foreign keys are not detected — confirm in the editor.",
  },
  {
    id: "json_schema",
    label: "JSON Schema",
    placeholder:
      '{\n  "title": "User",\n  "type": "object",\n  "required": ["id"],\n  "properties": {\n    "id": {"type": "integer"},\n    "email": {"type": "string", "format": "email"}\n  }\n}',
    helper:
      "Top-level object → one table. $defs entries become sibling tables.",
  },
  {
    id: "dbt",
    label: "dbt YAML",
    placeholder:
      'version: 2\nsources:\n  - name: app\n    tables:\n      - name: users\n        columns:\n          - name: id\n            data_type: integer\n            constraints:\n              - type: primary_key\n          - name: email\n            data_type: varchar(254)\n            tests:\n              - unique',
    helper:
      "sources.yml / schema.yml. Reads sources, models, and seeds with column definitions.",
  },
];

export function SchemaInput({
  initialDdl,
  onSchemaParsed,
}: {
  initialDdl: string;
  onSchemaParsed?: (schema: SchemaIR | null) => void;
}) {
  const [mode, setMode] = useState<SchemaInputKind>("sql");
  const [inputs, setInputs] = useState<Record<SchemaInputKind, string>>({
    sql: initialDdl,
    csv: "",
    json_schema: "",
    dbt: "",
  });
  const [state, setState] = useState<ParseState>({ kind: "idle" });
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[0];

  function handleParse() {
    setEditing(false);
    startTransition(async () => {
      const result = await parseSchemaAction({
        kind: mode,
        input: inputs[mode],
      });
      if (result.ok) {
        setState({ kind: "ok", schema: result.schema });
        onSchemaParsed?.(result.schema);
      } else {
        setState({ kind: "error", error: result.error });
        onSchemaParsed?.(null);
      }
    });
  }

  function handleReset() {
    setInputs({
      sql: initialDdl,
      csv: "",
      json_schema: "",
      dbt: "",
    });
    setMode("sql");
    setState({ kind: "idle" });
    setEditing(false);
    onSchemaParsed?.(null);
  }

  function handleEditorSave(schema: SchemaIR) {
    setState({ kind: "ok", schema });
    setEditing(false);
    onSchemaParsed?.(schema);
  }

  return (
    <section className="brutal-border brutal-shadow bg-white p-5 flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold uppercase tracking-wider">Schema</h2>
        <span className="text-xs uppercase opacity-60">{activeMode.label}</span>
      </header>
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              disabled={isPending}
              className={`brutal-border uppercase font-bold px-3 py-1 text-xs tracking-widest transition-colors ${
                active
                  ? "bg-cool text-paper"
                  : "bg-paper hover:bg-ink hover:text-paper"
              } disabled:opacity-60`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <textarea
        value={inputs[mode]}
        onChange={(e) =>
          setInputs((prev) => ({ ...prev, [mode]: e.target.value }))
        }
        spellCheck={false}
        maxLength={LIMITS.maxSchemaChars}
        rows={12}
        placeholder={activeMode.placeholder}
        className="brutal-border bg-paper p-3 font-mono text-xs leading-relaxed resize-y w-full"
      />
      <p className="text-xs opacity-60">{activeMode.helper}</p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleParse}
          disabled={isPending}
          className="brutal-border bg-accent uppercase font-bold px-4 py-2 tracking-widest hover:bg-cool hover:text-paper disabled:opacity-60 transition-colors"
        >
          {isPending ? "Parsing…" : "Parse Schema"}
        </button>
        <button
          onClick={handleReset}
          disabled={isPending}
          className="brutal-border bg-paper uppercase font-bold px-4 py-2 tracking-widest hover:bg-ink hover:text-paper disabled:opacity-60 transition-colors"
        >
          Reset
        </button>
      </div>
      {state.kind === "error" ? (
        <div className="brutal-border bg-hot text-paper p-3 text-sm whitespace-pre-wrap">
          <strong className="uppercase">Parse failed:</strong> {state.error}
        </div>
      ) : null}
      {state.kind === "ok" ? (
        <div className="flex flex-col gap-3">
          <div className="text-xs uppercase opacity-70">
            Parsed IR · {state.schema.tables.length} table
            {state.schema.tables.length === 1 ? "" : "s"}
          </div>
          {editing ? (
            <SchemaEditor
              initial={state.schema}
              onSave={handleEditorSave}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <SchemaPreview
              schema={state.schema}
              onEdit={() => setEditing(true)}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}
