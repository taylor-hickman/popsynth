#!/usr/bin/env node
import { flush, handle } from "@oclif/core";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import GenerateCommand from "../commands/generate";
import ParseCommand from "../commands/parse";
import PlanCommand from "../commands/plan";

const COMMANDS = {
  generate: GenerateCommand,
  parse: ParseCommand,
  plan: PlanCommand,
} as const;

type CommandName = keyof typeof COMMANDS;

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  const [commandName, ...rest] = argv;

  if (!commandName || commandName === "--help" || commandName === "-h") {
    process.stdout.write(rootHelp());
    return;
  }

  if (commandName === "--version" || commandName === "-v") {
    process.stdout.write(`${packageVersion()}\n`);
    return;
  }

  if (!isCommandName(commandName)) {
    throw new Error(`Unknown command "${commandName}". Run popsynth --help.`);
  }

  if (rest.includes("--help") || rest.includes("-h")) {
    process.stdout.write(commandHelp(commandName));
    return;
  }

  if (rest.includes("--version") || rest.includes("-v")) {
    process.stdout.write(`${packageVersion()}\n`);
    return;
  }

  await COMMANDS[commandName].run(rest, {
    root: process.cwd(),
    pjson: {
      name: "popsynth",
      version: packageVersion(),
      oclif: {
        bin: "popsynth",
      },
    },
  });
}

function isCommandName(value: string): value is CommandName {
  return value in COMMANDS;
}

function packageVersion(): string {
  return "0.1.0";
}

function rootHelp(): string {
  return `Pop Synth

USAGE
  popsynth <command> [flags]

COMMANDS
  parse      Parse a schema into SchemaIR JSON.
  plan       Create a reusable GenerationPlan JSON.
  generate   Generate themed synthetic CSV files.

GLOBAL FLAGS
  -h, --help      Show command help.
  -v, --version   Show CLI version.

EXAMPLES
  popsynth parse --schema schema.sql --schema-kind sql
  popsynth plan --schema schema.sql --schema-kind sql --theme "Gotham logistics"
  popsynth generate --schema schema.sql --schema-kind sql --theme "Studio Ghibli CRM" --out ./data
`;
}

function commandHelp(commandName: CommandName): string {
  const help = {
    generate: `Generate themed synthetic CSV files.

USAGE
  popsynth generate --schema <path|-> --schema-kind <sql|csv|json-schema|dbt> --theme <text> [flags]

FLAGS
  --out <dir>              Output directory. Defaults to ./popsynth-output.
  --force                  Allow writing into a non-empty output directory.
  --rows <count>           Row count for every table.
  --row <table=count>      Per-table row count override. Repeatable.
  --plan <path>            Read an existing GenerationPlan JSON file.
  --save-plan <path>       Write the GenerationPlan used for this run.
  --schema-ir <path>       Write the parsed SchemaIR used for this run.
  --planner-model <name>   Planner model override.
  --row-model <name>       Row generation model override.
  --json                   Write a machine-readable manifest to stdout.
  --quiet                  Suppress progress output.
  --verbose                Print row-level progress.
`,
    parse: `Parse a schema into Pop Synth SchemaIR.

USAGE
  popsynth parse --schema <path|-> --schema-kind <sql|csv|json-schema|dbt> [flags]

FLAGS
  --out <path>             Write JSON output to this path instead of stdout.
  --planner-model <name>   Planner model override for CSV inference.
  --json                   Accepted for global consistency; output is always JSON.
`,
    plan: `Create a reusable GenerationPlan for a schema and theme.

USAGE
  popsynth plan --schema <path|-> --schema-kind <sql|csv|json-schema|dbt> --theme <text> [flags]

FLAGS
  --out <path>             Write JSON output to this path instead of stdout.
  --rows <count>           Row count for every table.
  --row <table=count>      Per-table row count override. Repeatable.
  --planner-model <name>   Planner model override.
  --json                   Accepted for global consistency; output is always JSON.
`,
  };
  return help[commandName];
}

if (isDirectRun()) {
  runCli().then(
    async () => {
      await flush();
    },
    async (err) => {
      await handle(err);
    },
  );
}

function isDirectRun(): boolean {
  if (!process.argv[1]) return false;
  return (
    realpathSync(resolve(process.argv[1])) ===
    realpathSync(fileURLToPath(import.meta.url))
  );
}
