import type { GenerationPlan, SchemaIR } from "@/lib/types";

const PLACEHOLDER_ENTRY =
  /^([a-z_]+_)?(record|item|thing|entity|user|value)_\d+$/i;

export class PlanValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`GenerationPlan failed validation:\n  - ${issues.join("\n  - ")}`);
    this.issues = issues;
  }
}

/**
 * Cross-validate a GenerationPlan against its SchemaIR. Zod handles shape;
 * this enforces the relational constraints from PLAN.md stage 2.
 */
export function validatePlanAgainstSchema(
  plan: GenerationPlan,
  schema: SchemaIR,
): void {
  const issues: string[] = [];
  const schemaTables = new Map(schema.tables.map((t) => [t.name, t]));
  const planTables = new Map(plan.tables.map((t) => [t.name, t]));

  for (const name of schemaTables.keys()) {
    if (!planTables.has(name)) issues.push(`plan is missing table "${name}"`);
  }
  for (const name of planTables.keys()) {
    if (!schemaTables.has(name)) {
      issues.push(`plan has unknown table "${name}"`);
    }
  }

  for (const [poolName, entries] of Object.entries(plan.entityPools)) {
    if (!Array.isArray(entries)) continue;
    const seen = new Set<string>();
    for (const entry of entries) {
      if (PLACEHOLDER_ENTRY.test(entry)) {
        issues.push(
          `pool "${poolName}" contains placeholder entry "${entry}" — entries must be canonical proper nouns from the theme universe`,
        );
      }
      if (seen.has(entry)) {
        issues.push(`pool "${poolName}" has duplicate entry "${entry}"`);
      }
      seen.add(entry);
    }
  }

  for (const [tableName, planTable] of planTables) {
    const schemaTable = schemaTables.get(tableName);
    if (!schemaTable) continue;
    const schemaCols = new Set(schemaTable.columns.map((c) => c.name));
    const mappedCols = new Set<string>();
    for (const m of planTable.columnMappings) {
      if (mappedCols.has(m.column)) {
        issues.push(
          `table "${tableName}" maps column "${m.column}" more than once`,
        );
      }
      mappedCols.add(m.column);
      if (!schemaCols.has(m.column)) {
        issues.push(
          `table "${tableName}" mapping references unknown column "${m.column}"`,
        );
      }
    }
    for (const col of schemaCols) {
      if (!mappedCols.has(col)) {
        issues.push(
          `table "${tableName}" is missing mapping for column "${col}"`,
        );
      }
    }

    for (const fk of schemaTable.foreignKeys) {
      const mapping = planTable.columnMappings.find(
        (m) => m.column === fk.column,
      );
      if (!mapping) continue;
      if (!mapping.referencesPool) {
        issues.push(
          `table "${tableName}" FK column "${fk.column}" must set referencesPool`,
        );
        continue;
      }
      const pool = (
        plan.entityPools as Record<string, string[] | undefined>
      )[mapping.referencesPool];
      if (!pool) {
        issues.push(
          `table "${tableName}" FK column "${fk.column}" references unknown pool "${mapping.referencesPool}"`,
        );
        continue;
      }
    }
  }

  const orderSet = new Set(plan.generationOrder);
  if (orderSet.size !== plan.generationOrder.length) {
    issues.push("generationOrder contains duplicates");
  }
  for (const name of schemaTables.keys()) {
    if (!orderSet.has(name)) {
      issues.push(`generationOrder is missing table "${name}"`);
    }
  }
  for (const name of plan.generationOrder) {
    if (!schemaTables.has(name)) {
      issues.push(`generationOrder has unknown table "${name}"`);
    }
  }

  const indexInOrder = new Map(
    plan.generationOrder.map((n, i) => [n, i] as const),
  );
  for (const table of schema.tables) {
    for (const fk of table.foreignKeys) {
      const here = indexInOrder.get(table.name);
      const parent = indexInOrder.get(fk.refTable);
      if (here === undefined || parent === undefined) continue;
      if (parent >= here) {
        issues.push(
          `generationOrder places "${table.name}" before its FK parent "${fk.refTable}"`,
        );
      }
    }
  }

  if (issues.length > 0) throw new PlanValidationError(issues);
}
