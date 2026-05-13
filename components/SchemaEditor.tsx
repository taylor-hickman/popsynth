"use client";

import { useMemo, useState } from "react";
import { SchemaIR, type SchemaIR as SchemaIRType } from "popsynth/core";

type ColumnDraft = {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isUnique: boolean;
  enumValuesCsv: string;
};

type FkDraft = {
  id: string;
  column: string;
  refTable: string;
  refColumn: string;
};

type TableDraft = {
  id: string;
  name: string;
  columns: ColumnDraft[];
  foreignKeys: FkDraft[];
};

type SchemaDraft = { tables: TableDraft[] };

const SQL_TYPES = [
  "text",
  "varchar(254)",
  "integer",
  "bigint",
  "numeric",
  "numeric(10,2)",
  "boolean",
  "date",
  "timestamp",
  "timestamptz",
  "uuid",
  "jsonb",
];

let UID = 0;
const uid = () => `e${++UID}`;

function toDraft(schema: SchemaIRType): SchemaDraft {
  return {
    tables: schema.tables.map((t) => ({
      id: uid(),
      name: t.name,
      columns: t.columns.map((c) => ({
        id: uid(),
        name: c.name,
        type: c.type,
        nullable: c.nullable,
        isPrimaryKey: c.isPrimaryKey,
        isUnique: c.isUnique,
        enumValuesCsv: c.enumValues ? c.enumValues.join(", ") : "",
      })),
      foreignKeys: t.foreignKeys.map((fk) => ({
        id: uid(),
        column: fk.column,
        refTable: fk.refTable,
        refColumn: fk.refColumn,
      })),
    })),
  };
}

function toIR(draft: SchemaDraft): unknown {
  return {
    tables: draft.tables.map((t) => ({
      name: t.name.trim(),
      columns: t.columns.map((c) => {
        const enumList = c.enumValuesCsv
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        return {
          name: c.name.trim(),
          type: c.type.trim(),
          nullable: c.nullable,
          isPrimaryKey: c.isPrimaryKey,
          isUnique: c.isUnique || c.isPrimaryKey,
          enumValues: enumList.length > 0 ? enumList : null,
        };
      }),
      foreignKeys: t.foreignKeys.map((fk) => ({
        column: fk.column.trim(),
        refTable: fk.refTable.trim(),
        refColumn: fk.refColumn.trim(),
      })),
    })),
  };
}

type ErrorMap = Record<string, string>;

function zodErrorsToMap(
  draft: SchemaDraft,
  issues: { path: PropertyKey[]; message: string }[],
): { fieldErrors: ErrorMap; globalErrors: string[] } {
  const fieldErrors: ErrorMap = {};
  const globalErrors: string[] = [];
  for (const issue of issues) {
    const [, tableIdx, section, ...rest] = issue.path;
    const tIdx = typeof tableIdx === "number" ? tableIdx : -1;
    const table = tIdx >= 0 ? draft.tables[tIdx] : undefined;
    if (!table) {
      globalErrors.push(issue.message);
      continue;
    }
    if (section === "name") {
      fieldErrors[`${table.id}.tableName`] = issue.message;
      continue;
    }
    if (section === "columns") {
      const [colIdx, colField] = rest;
      const cIdx = typeof colIdx === "number" ? colIdx : -1;
      const column = cIdx >= 0 ? table.columns[cIdx] : undefined;
      if (column && typeof colField === "string") {
        fieldErrors[`${table.id}.col.${column.id}.${colField}`] = issue.message;
      } else {
        globalErrors.push(`${table.name}: ${issue.message}`);
      }
      continue;
    }
    if (section === "foreignKeys") {
      const [fkIdx, fkField] = rest;
      const fIdx = typeof fkIdx === "number" ? fkIdx : -1;
      const fk = fIdx >= 0 ? table.foreignKeys[fIdx] : undefined;
      if (fk && typeof fkField === "string") {
        fieldErrors[`${table.id}.fk.${fk.id}.${fkField}`] = issue.message;
      } else {
        globalErrors.push(`${table.name}: ${issue.message}`);
      }
      continue;
    }
    globalErrors.push(`${table.name}: ${issue.message}`);
  }
  return { fieldErrors, globalErrors };
}

const COL_GRID =
  "flex flex-wrap items-center gap-2 md:grid md:grid-cols-[1.4fr_1.2fr_auto_1fr_auto]";
const COL_HEADER =
  "hidden md:grid md:grid-cols-[1.4fr_1.2fr_auto_1fr_auto] md:gap-2 md:items-center";

export function SchemaEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: SchemaIRType;
  onSave: (schema: SchemaIRType) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<SchemaDraft>(() => toDraft(initial));
  const [errors, setErrors] = useState<ErrorMap>({});
  const [globalErrors, setGlobalErrors] = useState<string[]>([]);

  const refTableOptions = useMemo(
    () => draft.tables.map((t) => t.name).filter((name) => name.length > 0),
    [draft],
  );

  function update(fn: (next: SchemaDraft) => void) {
    setDraft((prev) => {
      const next: SchemaDraft = {
        tables: prev.tables.map((t) => ({
          ...t,
          columns: t.columns.map((c) => ({ ...c })),
          foreignKeys: t.foreignKeys.map((fk) => ({ ...fk })),
        })),
      };
      fn(next);
      return next;
    });
  }

  function addTable() {
    update((d) => {
      d.tables.push({
        id: uid(),
        name: `table_${d.tables.length + 1}`,
        columns: [
          {
            id: uid(),
            name: "id",
            type: "integer",
            nullable: false,
            isPrimaryKey: true,
            isUnique: true,
            enumValuesCsv: "",
          },
        ],
        foreignKeys: [],
      });
    });
  }

  function deleteTable(tableId: string) {
    update((d) => {
      d.tables = d.tables.filter((t) => t.id !== tableId);
    });
  }

  function renameTable(tableId: string, name: string) {
    update((d) => {
      const t = d.tables.find((x) => x.id === tableId);
      if (t) t.name = name;
    });
  }

  function addColumn(tableId: string) {
    update((d) => {
      const t = d.tables.find((x) => x.id === tableId);
      if (!t) return;
      t.columns.push({
        id: uid(),
        name: `column_${t.columns.length + 1}`,
        type: "text",
        nullable: true,
        isPrimaryKey: false,
        isUnique: false,
        enumValuesCsv: "",
      });
    });
  }

  function deleteColumn(tableId: string, columnId: string) {
    update((d) => {
      const t = d.tables.find((x) => x.id === tableId);
      if (!t) return;
      t.columns = t.columns.filter((c) => c.id !== columnId);
    });
  }

  function updateColumn(
    tableId: string,
    columnId: string,
    patch: Partial<ColumnDraft>,
  ) {
    update((d) => {
      const t = d.tables.find((x) => x.id === tableId);
      if (!t) return;
      const c = t.columns.find((x) => x.id === columnId);
      if (!c) return;
      Object.assign(c, patch);
    });
  }

  function addFk(tableId: string) {
    update((d) => {
      const t = d.tables.find((x) => x.id === tableId);
      if (!t) return;
      const others = d.tables.filter((x) => x.id !== tableId);
      t.foreignKeys.push({
        id: uid(),
        column: "",
        refTable: others[0]?.name ?? "",
        refColumn: "id",
      });
    });
  }

  function deleteFk(tableId: string, fkId: string) {
    update((d) => {
      const t = d.tables.find((x) => x.id === tableId);
      if (!t) return;
      t.foreignKeys = t.foreignKeys.filter((fk) => fk.id !== fkId);
    });
  }

  function updateFk(
    tableId: string,
    fkId: string,
    patch: Partial<FkDraft>,
  ) {
    update((d) => {
      const t = d.tables.find((x) => x.id === tableId);
      if (!t) return;
      const fk = t.foreignKeys.find((x) => x.id === fkId);
      if (!fk) return;
      Object.assign(fk, patch);
    });
  }

  function handleSave() {
    const candidate = toIR(draft);
    const result = SchemaIR.safeParse(candidate);
    if (result.success) {
      setErrors({});
      setGlobalErrors([]);
      onSave(result.data);
      return;
    }
    const { fieldErrors, globalErrors: globals } = zodErrorsToMap(
      draft,
      result.error.issues.map((i) => ({
        path: [...i.path] as PropertyKey[],
        message: i.message,
      })),
    );
    setErrors(fieldErrors);
    setGlobalErrors(globals);
  }

  return (
    <div className="flex flex-col gap-5">
      <datalist id="sql-types">
        {SQL_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <ActionBar
        onSave={handleSave}
        onCancel={onCancel}
        onAddTable={addTable}
        position="top"
      />

      {draft.tables.map((table, idx) => (
        <TableCard
          key={table.id}
          table={table}
          index={idx + 1}
          errors={errors}
          refTableOptions={refTableOptions.filter((n) => n !== table.name)}
          onRename={(name) => renameTable(table.id, name)}
          onDeleteTable={() => deleteTable(table.id)}
          onAddColumn={() => addColumn(table.id)}
          onDeleteColumn={(colId) => deleteColumn(table.id, colId)}
          onUpdateColumn={(colId, patch) =>
            updateColumn(table.id, colId, patch)
          }
          onAddFk={() => addFk(table.id)}
          onDeleteFk={(fkId) => deleteFk(table.id, fkId)}
          onUpdateFk={(fkId, patch) => updateFk(table.id, fkId, patch)}
        />
      ))}

      {draft.tables.length === 0 ? (
        <div className="brutal-border bg-paper p-6 text-center text-xs uppercase opacity-70">
          No tables yet. Click + Table to begin.
        </div>
      ) : null}

      {globalErrors.length > 0 ? (
        <div className="brutal-border bg-hot text-paper p-3 text-xs whitespace-pre-wrap">
          <strong className="uppercase block mb-1">Cannot save:</strong>
          <ul className="list-disc ml-4">
            {globalErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <ActionBar
        onSave={handleSave}
        onCancel={onCancel}
        onAddTable={addTable}
        position="bottom"
      />
    </div>
  );
}

function ActionBar({
  onSave,
  onCancel,
  onAddTable,
  position,
}: {
  onSave: () => void;
  onCancel: () => void;
  onAddTable: () => void;
  position: "top" | "bottom";
}) {
  return (
    <div className="brutal-border bg-paper p-3 flex flex-wrap items-center gap-3">
      <span className="text-[10px] uppercase tracking-widest opacity-60">
        {position === "top" ? "Editing schema" : "Done editing?"}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAddTable}
          className="brutal-border bg-paper uppercase font-bold px-3 py-1 text-xs tracking-widest hover:bg-cool hover:text-paper transition-colors"
        >
          + Table
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="brutal-border bg-paper uppercase font-bold px-3 py-1 text-xs tracking-widest hover:bg-ink hover:text-paper transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="brutal-border bg-accent uppercase font-bold px-4 py-1.5 text-xs tracking-widest hover:bg-cool hover:text-paper transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function TableCard({
  table,
  index,
  errors,
  refTableOptions,
  onRename,
  onDeleteTable,
  onAddColumn,
  onDeleteColumn,
  onUpdateColumn,
  onAddFk,
  onDeleteFk,
  onUpdateFk,
}: {
  table: TableDraft;
  index: number;
  errors: ErrorMap;
  refTableOptions: string[];
  onRename: (name: string) => void;
  onDeleteTable: () => void;
  onAddColumn: () => void;
  onDeleteColumn: (colId: string) => void;
  onUpdateColumn: (colId: string, patch: Partial<ColumnDraft>) => void;
  onAddFk: () => void;
  onDeleteFk: (fkId: string) => void;
  onUpdateFk: (fkId: string, patch: Partial<FkDraft>) => void;
}) {
  const tableNameErr = errors[`${table.id}.tableName`];
  return (
    <div className="brutal-border brutal-shadow-sm bg-paper">
      <header className="flex items-center gap-3 px-4 py-3 border-b-3 border-ink bg-accent" style={{ borderBottom: "3px solid var(--color-ink)" }}>
        <span className="text-[10px] uppercase tracking-widest opacity-70">
          Table {index}
        </span>
        <input
          value={table.name}
          onChange={(e) => onRename(e.target.value)}
          className="bg-paper brutal-border px-2 py-1 font-bold uppercase tracking-wider text-base flex-1 min-w-[180px]"
          spellCheck={false}
          aria-label="Table name"
        />
        <button
          type="button"
          onClick={onDeleteTable}
          className="brutal-border bg-paper uppercase font-bold px-2 py-1 text-[10px] tracking-widest hover:bg-hot hover:text-paper transition-colors"
          title="Delete table"
        >
          Delete Table
        </button>
      </header>
      {tableNameErr ? (
        <p className="text-xs text-hot px-4 pt-2">{tableNameErr}</p>
      ) : null}

      <section className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-80">
            Columns
          </h4>
          <button
            type="button"
            onClick={onAddColumn}
            className="brutal-border bg-paper uppercase font-bold px-2 py-0.5 text-[10px] tracking-widest hover:bg-cool hover:text-paper transition-colors"
          >
            + Column
          </button>
        </div>

        <div
          className={`${COL_HEADER} text-[10px] uppercase tracking-widest opacity-60 px-1 pb-1 border-b-2 border-ink`}
        >
          <span>Name</span>
          <span>Type</span>
          <span className="text-center">Flags</span>
          <span>Enum values (comma-sep)</span>
          <span></span>
        </div>

        <ul className="flex flex-col">
          {table.columns.map((col) => (
            <ColumnRow
              key={col.id}
              col={col}
              errors={errors}
              tableId={table.id}
              onUpdate={(patch) => onUpdateColumn(col.id, patch)}
              onDelete={() => onDeleteColumn(col.id)}
            />
          ))}
        </ul>
      </section>

      <section className="px-4 pb-4 pt-1 border-t-2 border-ink">
        <div className="flex items-center justify-between mt-2 mb-2">
          <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-80">
            Foreign keys
            <span className="ml-2 opacity-50 normal-case tracking-normal">
              ({table.foreignKeys.length})
            </span>
          </h4>
          <button
            type="button"
            onClick={onAddFk}
            className="brutal-border bg-paper uppercase font-bold px-2 py-0.5 text-[10px] tracking-widest hover:bg-cool hover:text-paper transition-colors"
          >
            + FK
          </button>
        </div>

        {table.foreignKeys.length === 0 ? (
          <p className="text-xs opacity-50 italic">
            No foreign keys on this table.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {table.foreignKeys.map((fk) => (
              <FkRow
                key={fk.id}
                fk={fk}
                errors={errors}
                tableId={table.id}
                refTableOptions={refTableOptions}
                onUpdate={(patch) => onUpdateFk(fk.id, patch)}
                onDelete={() => onDeleteFk(fk.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ColumnRow({
  col,
  errors,
  tableId,
  onUpdate,
  onDelete,
}: {
  col: ColumnDraft;
  errors: ErrorMap;
  tableId: string;
  onUpdate: (patch: Partial<ColumnDraft>) => void;
  onDelete: () => void;
}) {
  const nameErr = errors[`${tableId}.col.${col.id}.name`];
  const typeErr = errors[`${tableId}.col.${col.id}.type`];
  return (
    <li className="border-b border-ink/30 last:border-b-0 py-2">
      <div className={COL_GRID}>
        <input
          value={col.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="column_name"
          className="brutal-border bg-paper px-2 py-1 font-mono text-xs min-w-0 flex-1 basis-[40%]"
          spellCheck={false}
          aria-label="Column name"
        />
        <input
          list="sql-types"
          value={col.type}
          onChange={(e) => onUpdate({ type: e.target.value })}
          placeholder="text"
          className="brutal-border bg-paper px-2 py-1 font-mono text-xs min-w-0 flex-1 basis-[40%]"
          spellCheck={false}
          aria-label="Column type"
        />
        <FlagToggles col={col} onUpdate={onUpdate} />
        <input
          value={col.enumValuesCsv}
          onChange={(e) => onUpdate({ enumValuesCsv: e.target.value })}
          placeholder="enum: a, b, c (optional)"
          className="brutal-border bg-paper px-2 py-1 font-mono text-xs min-w-0 flex-1 basis-[60%]"
          spellCheck={false}
          aria-label="Enum values"
        />
        <button
          type="button"
          onClick={onDelete}
          className="brutal-border bg-paper uppercase font-bold px-2 py-1 text-[10px] tracking-widest hover:bg-hot hover:text-paper transition-colors ml-auto md:ml-0"
          aria-label="Delete column"
          title="Delete column"
        >
          ×
        </button>
      </div>
      {nameErr || typeErr ? (
        <div className="text-[11px] text-hot mt-1 flex flex-col gap-0.5">
          {nameErr ? <span>name: {nameErr}</span> : null}
          {typeErr ? <span>type: {typeErr}</span> : null}
        </div>
      ) : null}
    </li>
  );
}

function FlagToggles({
  col,
  onUpdate,
}: {
  col: ColumnDraft;
  onUpdate: (patch: Partial<ColumnDraft>) => void;
}) {
  return (
    <div className="flex items-center gap-1 justify-center">
      <FlagButton
        label="PK"
        active={col.isPrimaryKey}
        title="Primary key"
        onClick={() => {
          const next = !col.isPrimaryKey;
          onUpdate({
            isPrimaryKey: next,
            isUnique: next ? true : col.isUnique,
            nullable: next ? false : col.nullable,
          });
        }}
      />
      <FlagButton
        label="UQ"
        active={col.isUnique}
        title="Unique"
        disabled={col.isPrimaryKey}
        onClick={() => onUpdate({ isUnique: !col.isUnique })}
      />
      <FlagButton
        label="NULL"
        active={col.nullable}
        title="Nullable"
        disabled={col.isPrimaryKey}
        onClick={() => onUpdate({ nullable: !col.nullable })}
      />
    </div>
  );
}

function FlagButton({
  label,
  active,
  disabled,
  title,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
}) {
  const base =
    "brutal-border px-1.5 py-0.5 text-[10px] font-bold tracking-widest transition-colors w-10 text-center";
  const tone = active
    ? label === "PK"
      ? "bg-cool text-paper"
      : label === "UQ"
        ? "bg-ink text-paper"
        : "bg-accent"
    : "bg-paper opacity-50 hover:opacity-100";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={`${base} ${tone} disabled:cursor-not-allowed disabled:hover:opacity-50`}
    >
      {label}
    </button>
  );
}

function FkRow({
  fk,
  errors,
  tableId,
  refTableOptions,
  onUpdate,
  onDelete,
}: {
  fk: FkDraft;
  errors: ErrorMap;
  tableId: string;
  refTableOptions: string[];
  onUpdate: (patch: Partial<FkDraft>) => void;
  onDelete: () => void;
}) {
  const colErr = errors[`${tableId}.fk.${fk.id}.column`];
  const tblErr = errors[`${tableId}.fk.${fk.id}.refTable`];
  const refColErr = errors[`${tableId}.fk.${fk.id}.refColumn`];
  return (
    <li className="brutal-border bg-paper px-2 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={fk.column}
          onChange={(e) => onUpdate({ column: e.target.value })}
          placeholder="local column"
          className="brutal-border bg-paper px-2 py-1 font-mono text-xs w-36"
          spellCheck={false}
          aria-label="Local FK column"
        />
        <span className="text-xs opacity-60 px-1">→</span>
        <select
          value={fk.refTable}
          onChange={(e) => onUpdate({ refTable: e.target.value })}
          className="brutal-border bg-paper px-2 py-1 font-mono text-xs"
          aria-label="Referenced table"
        >
          <option value="">— ref table —</option>
          {refTableOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          {fk.refTable && !refTableOptions.includes(fk.refTable) ? (
            <option value={fk.refTable}>{fk.refTable} (external)</option>
          ) : null}
        </select>
        <span className="text-xs opacity-60 px-1">.</span>
        <input
          value={fk.refColumn}
          onChange={(e) => onUpdate({ refColumn: e.target.value })}
          placeholder="ref_column"
          className="brutal-border bg-paper px-2 py-1 font-mono text-xs w-32"
          spellCheck={false}
          aria-label="Referenced column"
        />
        <button
          type="button"
          onClick={onDelete}
          className="brutal-border bg-paper uppercase font-bold px-2 py-1 text-[10px] tracking-widest hover:bg-hot hover:text-paper transition-colors ml-auto"
          aria-label="Delete foreign key"
        >
          ×
        </button>
      </div>
      {colErr || tblErr || refColErr ? (
        <div className="text-[11px] text-hot mt-1 flex flex-col gap-0.5">
          {colErr ? <span>column: {colErr}</span> : null}
          {tblErr ? <span>ref table: {tblErr}</span> : null}
          {refColErr ? <span>ref column: {refColErr}</span> : null}
        </div>
      ) : null}
    </li>
  );
}
