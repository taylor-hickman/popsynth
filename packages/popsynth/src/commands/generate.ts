import { Command, Flags } from "@oclif/core";
import { z } from "zod";
import { getCliDependencies } from "../cli/dependencies";
import {
  buildParseRequest,
  buildRowCounts,
  commonFlags,
  ensureAnthropicKey,
  outputPath,
  plannerModelFlag,
  prepareOutputDirectory,
  readGenerationPlan,
  readInputText,
  rowModelFlag,
  rowOverrideFlag,
  rowsFlag,
  schemaFlag,
  schemaKindFlag,
  writeJsonOutput,
  writeTextFile,
} from "../cli/shared";
import {
  LIMITS,
  type FormatterOutput,
  type GenerateEvent,
  type SchemaIR,
} from "../core/index";

type FileManifest = {
  filename: string;
  path: string;
  rows: number;
};

type GenerateManifest = {
  theme: string;
  outputDir: string;
  files: FileManifest[];
  planPath: string | null;
  schemaIrPath: string | null;
};

export default class GenerateCommand extends Command {
  static summary = "Generate themed synthetic data files.";

  static flags = {
    ...commonFlags,
    force: Flags.boolean({
      description: "Allow writing into a non-empty output directory.",
    }),
    out: Flags.string({
      default: "./popsynth-output",
      description: "Output directory for generated CSV files.",
    }),
    plan: Flags.string({
      description: "Read an existing GenerationPlan JSON file instead of planning.",
    }),
    "planner-model": plannerModelFlag,
    row: rowOverrideFlag,
    "row-model": rowModelFlag,
    rows: rowsFlag,
    "save-plan": Flags.string({
      description: "Write the GenerationPlan used for this run to a JSON file.",
    }),
    schema: schemaFlag,
    "schema-ir": Flags.string({
      description: "Write the parsed SchemaIR used for this run to a JSON file.",
    }),
    "schema-kind": schemaKindFlag,
    theme: Flags.string({
      description: `Theme for the generated dataset, max ${LIMITS.maxThemeChars} chars.`,
      required: true,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(GenerateCommand);
    ensureAnthropicKey();

    const deps = getCliDependencies();
    const theme = z.string().trim().min(1).max(LIMITS.maxThemeChars).parse(flags.theme);
    const schema = await this.loadSchema(flags.schema, flags["schema-kind"], flags["planner-model"]);
    if (flags["schema-ir"]) writeJsonOutput(schema, flags["schema-ir"]);

    const rowCounts = buildRowCounts(schema, flags.rows, flags.row);
    const plan = flags.plan
      ? readGenerationPlan(flags.plan)
      : await deps.runMappingAgent(schema, theme, rowCounts, {
          plannerModelName: flags["planner-model"],
        });
    deps.validatePlanAgainstSchema(plan, schema);
    if (flags["save-plan"]) writeJsonOutput(plan, flags["save-plan"]);

    const outputDir = prepareOutputDirectory(flags.out, flags.force ?? false);
    const records = await deps.generateAllTables(plan, schema, {
      onEvent: (event) => this.reportProgress(event, flags.quiet ?? false, flags.verbose ?? false),
      rowModelName: flags["row-model"],
    });
    const files: FormatterOutput[] = deps.getFormatter("csv")(
      records,
      schema,
      plan,
    );
    const manifestFiles = files.map((file, index) => {
      const path = outputPath(outputDir, file.filename);
      writeTextFile(path, file.content);
      const table = schema.tables[index];
      return {
        filename: file.filename,
        path,
        rows: table ? (records[table.name] ?? []).length : 0,
      };
    });

    const manifest: GenerateManifest = {
      theme: plan.theme,
      outputDir,
      files: manifestFiles,
      planPath: flags["save-plan"] ?? flags.plan ?? null,
      schemaIrPath: flags["schema-ir"] ?? null,
    };

    if (flags.json) {
      writeJsonOutput(manifest, undefined);
    } else if (!flags.quiet) {
      this.log(`Wrote ${manifest.files.length} CSV file(s) to ${manifest.outputDir}`);
    }
  }

  private async loadSchema(
    schemaPath: string,
    schemaKind: string,
    plannerModelName: string | undefined,
  ): Promise<SchemaIR> {
    const input = await readInputText(schemaPath);
    return await getCliDependencies().parseSchemaOrThrow(
      buildParseRequest(schemaKind, input),
      { plannerModelName },
    );
  }

  private reportProgress(event: GenerateEvent, quiet: boolean, verbose: boolean): void {
    if (quiet) return;
    if (event.type === "table-start") {
      this.logToStderr(`Generating ${event.table} (${event.rowCount} rows)`);
    } else if (event.type === "table-complete") {
      this.logToStderr(`Completed ${event.table} (${event.rowCount} rows)`);
    } else if (event.type === "table-failed") {
      this.logToStderr(`Failed ${event.table}: ${event.reason}`);
    } else if (event.type === "rows" && verbose) {
      this.logToStderr(`Generated ${event.rows.length} row(s) for ${event.table}`);
    }
  }
}
