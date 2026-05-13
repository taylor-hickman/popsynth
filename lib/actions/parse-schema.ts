"use server";

import {
  parseSchemaInput,
  type ParseSchemaRequest,
  type ParseSchemaResult,
  type SchemaInputKind,
} from "popsynth/core";

export type { ParseSchemaRequest, ParseSchemaResult, SchemaInputKind };

export async function parseSchemaAction(
  req: ParseSchemaRequest,
): Promise<ParseSchemaResult> {
  return await parseSchemaInput(req);
}
