import {
  generateAllTables,
  getFormatter,
  parseSchemaOrThrow,
  runMappingAgent,
  validatePlanAgainstSchema,
} from "../core/index";

export const defaultCliDependencies = {
  generateAllTables,
  getFormatter,
  parseSchemaOrThrow,
  runMappingAgent,
  validatePlanAgainstSchema,
};

export type CliDependencies = typeof defaultCliDependencies;

let activeDependencies: CliDependencies = defaultCliDependencies;

export function getCliDependencies(): CliDependencies {
  return activeDependencies;
}

export function setCliDependencies(
  overrides: Partial<CliDependencies>,
): () => void {
  const previous = activeDependencies;
  activeDependencies = { ...activeDependencies, ...overrides };
  return () => {
    activeDependencies = previous;
  };
}
