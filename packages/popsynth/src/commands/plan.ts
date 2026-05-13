import { Command, Flags } from "@oclif/core";
import { z } from "zod";
import { getCliDependencies } from "../cli/dependencies";
import {
  buildParseRequest,
  buildRowCounts,
  commonFlags,
  ensureAnthropicKey,
  outFileFlag,
  plannerModelFlag,
  readInputText,
  rowOverrideFlag,
  rowsFlag,
  schemaFlag,
  schemaKindFlag,
  writeJsonOutput,
} from "../cli/shared";
import { LIMITS } from "../core/index";

export default class PlanCommand extends Command {
  static summary = "Create a reusable GenerationPlan for a schema and theme.";

  static flags = {
    ...commonFlags,
    out: outFileFlag,
    "planner-model": plannerModelFlag,
    row: rowOverrideFlag,
    rows: rowsFlag,
    schema: schemaFlag,
    "schema-kind": schemaKindFlag,
    theme: Flags.string({
      description: `Theme for the generated dataset, max ${LIMITS.maxThemeChars} chars.`,
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PlanCommand);
    ensureAnthropicKey();
    const theme = z.string().trim().min(1).max(LIMITS.maxThemeChars).parse(flags.theme);
    const input = await readInputText(flags.schema);
    const schema = await getCliDependencies().parseSchemaOrThrow(
      buildParseRequest(flags["schema-kind"], input),
      { plannerModelName: flags["planner-model"] },
    );
    const rowCounts = buildRowCounts(schema, flags.rows, flags.row);
    const plan = await getCliDependencies().runMappingAgent(
      schema,
      theme,
      rowCounts,
      { plannerModelName: flags["planner-model"] },
    );
    writeJsonOutput(plan, flags.out);
  }
}
