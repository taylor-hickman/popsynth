import type { Formatter } from "../types";
import { csvFormatter } from "./csv";

export const FORMATS = ["csv"] as const;
export type FormatId = (typeof FORMATS)[number];

const REGISTRY: Record<FormatId, Formatter> = {
  csv: csvFormatter,
};

export function getFormatter(id: FormatId): Formatter {
  return REGISTRY[id];
}
