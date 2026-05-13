import type { SchemaIR } from "popsynth/core";

export function SchemaPreview({
  schema,
  onEdit,
}: {
  schema: SchemaIR;
  onEdit?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {onEdit ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onEdit}
            className="brutal-border bg-paper uppercase font-bold px-3 py-1 text-xs tracking-widest hover:bg-ink hover:text-paper transition-colors"
          >
            ✎ Edit
          </button>
        </div>
      ) : null}
      {schema.tables.map((table) => (
        <div key={table.name} className="brutal-border bg-paper p-3">
          <p className="font-bold uppercase tracking-wider">{table.name}</p>
          <ul className="text-xs mt-1 space-y-0.5">
            {table.columns.map((col) => (
              <li key={col.name} className="flex flex-wrap gap-2 items-baseline">
                <span className="font-bold">{col.name}</span>
                <span className="opacity-60">{col.type}</span>
                {col.isPrimaryKey ? (
                  <span className="bg-cool text-paper px-1">PK</span>
                ) : null}
                {col.isUnique && !col.isPrimaryKey ? (
                  <span className="bg-ink text-paper px-1">UQ</span>
                ) : null}
                {col.nullable ? (
                  <span className="bg-paper brutal-border px-1 text-[10px]">
                    NULLABLE
                  </span>
                ) : null}
                {col.enumValues ? (
                  <span className="opacity-70">
                    enum: [{col.enumValues.join(", ")}]
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {table.foreignKeys.length > 0 ? (
            <p className="text-xs mt-2 opacity-70">
              FK:{" "}
              {table.foreignKeys
                .map((fk) => `${fk.column} → ${fk.refTable}.${fk.refColumn}`)
                .join(", ")}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
