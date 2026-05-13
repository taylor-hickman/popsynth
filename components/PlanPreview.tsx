import type { GenerationPlan } from "@/lib/types";

export function PlanPreview({ plan }: { plan: GenerationPlan }) {
  const pools = Object.entries(plan.entityPools).filter(
    (entry): entry is [string, string[]] => Array.isArray(entry[1]),
  );
  return (
    <section className="brutal-border brutal-shadow bg-white">
      <header
        className="bg-cool text-paper px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap"
        style={{ borderBottom: "3px solid var(--color-ink)" }}
      >
        <h2 className="text-lg font-bold uppercase tracking-wider">
          Generation Plan
        </h2>
        <span className="text-xs uppercase opacity-80 truncate max-w-full">
          theme: {plan.theme}
        </span>
      </header>

      <div className="p-5 flex flex-col gap-5">
        <Block label="Theme interpretation">
          <p className="text-sm leading-relaxed">{plan.themeInterpretation}</p>
        </Block>

        <Divider />

        <Block label={`Entity pools (${pools.length})`}>
          <dl className="flex flex-col gap-3">
            {pools.map(([name, entries]) => (
              <PoolRow key={name} name={name} entries={entries} />
            ))}
          </dl>
        </Block>

        <Divider />

        <Block label={`Tables (${plan.tables.length})`}>
          <div className="flex flex-col gap-5">
            {plan.tables.map((t) => (
              <TableEntry
                key={t.name}
                name={t.name}
                rowCount={t.rowCount}
                thematicRole={t.thematicRole}
                constraints={t.constraints}
              />
            ))}
          </div>
        </Block>

        <Divider />

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <span className="text-[10px] uppercase tracking-widest font-bold opacity-70">
            Generation order
          </span>
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
            {plan.generationOrder.map((name, i) => (
              <li key={`${name}-${i}`} className="flex items-center gap-1">
                <span className="brutal-border bg-paper px-2 py-0.5 font-bold uppercase tracking-wider text-[11px]">
                  {name}
                </span>
                {i < plan.generationOrder.length - 1 ? (
                  <span className="opacity-60">→</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Block({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-70">
        {label}
      </h3>
      {children}
    </div>
  );
}

function Divider() {
  return <hr className="border-0 border-t-2 border-ink/20" />;
}

function PoolRow({ name, entries }: { name: string; entries: string[] }) {
  const PREVIEW = 10;
  const visible = entries.slice(0, PREVIEW);
  const overflow = entries.length - visible.length;
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="font-bold uppercase tracking-wider text-xs min-w-[8rem]">
        {name}{" "}
        <span className="opacity-50 normal-case tracking-normal">
          ({entries.length})
        </span>
      </dt>
      <dd className="flex flex-wrap items-baseline gap-1 flex-1 min-w-0">
        {visible.map((entry, i) => (
          <span
            key={`${entry}-${i}`}
            className="brutal-border bg-paper px-1.5 py-0.5 text-[10px] leading-tight"
            title={entry}
          >
            {entry}
          </span>
        ))}
        {overflow > 0 ? (
          <span className="text-[10px] opacity-60 self-center">
            +{overflow} more
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function TableEntry({
  name,
  rowCount,
  thematicRole,
  constraints,
}: {
  name: string;
  rowCount: number;
  thematicRole: string;
  constraints: string[];
}) {
  return (
    <article className="flex flex-col gap-2">
      <div
        className="flex flex-wrap items-baseline justify-between gap-2 pb-1"
        style={{ borderBottom: "2px solid var(--color-ink)" }}
      >
        <span className="font-bold uppercase tracking-wider text-base">
          {name}
        </span>
        <span className="text-[11px] uppercase tracking-widest opacity-70">
          {rowCount} {rowCount === 1 ? "row" : "rows"}
        </span>
      </div>
      <p className="text-xs leading-relaxed">
        <span className="text-[10px] uppercase tracking-widest font-bold opacity-60 mr-2">
          Role
        </span>
        {thematicRole}
      </p>
      {constraints.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold opacity-60 mb-1">
            Constraints ({constraints.length})
          </p>
          <ul className="text-xs space-y-0.5 opacity-90">
            {constraints.map((rule, i) => (
              <li key={i} className="flex gap-2">
                <span className="opacity-50">·</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
