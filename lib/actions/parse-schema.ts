"use server";

import { parseSchemaInput } from "popsynth/core";
import {
  type ParseSchemaRequest,
  type ParseSchemaResult,
} from "popsynth/core";

export async function parseSchemaAction(
  req: ParseSchemaRequest,
): Promise<ParseSchemaResult> {
  return await parseSchemaInput(req);
}
