import { Command } from "@oclif/core";
import { getCliDependencies } from "../cli/dependencies";
import {
  buildParseRequest,
  commonFlags,
  outFileFlag,
  plannerModelFlag,
  readInputText,
  schemaFlag,
  schemaKindFlag,
  writeJsonOutput,
} from "../cli/shared";

export default class ParseCommand extends Command {
  static summary = "Parse a schema into Pop Synth SchemaIR.";

  static flags = {
    ...commonFlags,
    out: outFileFlag,
    "planner-model": plannerModelFlag,
    schema: schemaFlag,
    "schema-kind": schemaKindFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ParseCommand);
    const input = await readInputText(flags.schema);
    const schema = await getCliDependencies().parseSchemaOrThrow(
      buildParseRequest(flags["schema-kind"], input),
      { plannerModelName: flags["planner-model"] },
    );
    writeJsonOutput(schema, flags.out);
  }
}
