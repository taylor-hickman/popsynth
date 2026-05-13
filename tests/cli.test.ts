import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../packages/popsynth/src/bin/run";
import { setCliDependencies } from "../packages/popsynth/src/cli/dependencies";
import type {
  GeneratedRecords,
  GenerateOptions,
  GenerationPlan,
  SchemaIR,
} from "popsynth/core";

const schema: SchemaIR = {
  tables: [
    {
      name: "users",
      columns: [
        {
          name: "id",
          type: "integer",
          nullable: false,
          isPrimaryKey: true,
          isUnique: true,
          enumValues: null,
        },
        {
          name: "email",
          type: "varchar(254)",
          nullable: false,
          isPrimaryKey: false,
          isUnique: true,
          enumValues: null,
        },
      ],
      foreignKeys: [],
    },
  ],
};

const plan: GenerationPlan = {
  theme: "Gotham logistics",
  themeInterpretation: "Noir city operations with grounded comic-book references.",
  entityPools: {
    characters: [
      "Bruce Wayne",
      "Selina Kyle",
      "Jim Gordon",
      "Lucius Fox",
      "Harvey Dent",
      "Oswald Cobblepot",
    ],
  },
  tables: [
    {
      name: "users",
      rowCount: 1,
      thematicRole: "Account owners in the city operations system.",
      constraints: [],
      columnMappings: [
        {
          column: "id",
          semanticType: "numeric_id",
          thematicHint: "Sequential user id.",
          examples: ["1", "2"],
          referencesPool: null,
        },
        {
          column: "email",
          semanticType: "email",
          thematicHint: "Gotham themed email address.",
          examples: ["bruce@wayne.example", "selina@eastend.example"],
          referencesPool: null,
        },
      ],
    },
  ],
  generationOrder: ["users"],
};

let restoreDependencies: (() => void) | null = null;
let restoreEnv: (() => void) | null = null;

afterEach(() => {
  restoreDependencies?.();
  restoreDependencies = null;
  restoreEnv?.();
  restoreEnv = null;
});

describe("popsynth CLI", () => {
  it("prints root help and version", async () => {
    const help = await captureOutput(() => runCli(["--help"]));
    expect(help.stdout).toContain("popsynth <command>");
    expect(help.stdout).toContain("generate");

    const version = await captureOutput(() => runCli(["--version"]));
    expect(version.stdout.trim()).toBe("0.1.0");
  });

  it("rejects missing required parse flags", async () => {
    await expect(runCli(["parse"])).rejects.toThrow();
  });

  it("parses SQL schema input without live LLM calls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "popsynth-cli-"));
    try {
      const schemaPath = join(dir, "schema.sql");
      writeFileSync(
        schemaPath,
        "CREATE TABLE users (id integer PRIMARY KEY, email varchar(254) UNIQUE NOT NULL);",
      );

      const result = await captureOutput(() =>
        runCli(["parse", "--schema", schemaPath, "--schema-kind", "sql"]),
      );
      const parsed = JSON.parse(result.stdout) as SchemaIR;
      expect(parsed.tables[0].name).toBe("users");
      expect(parsed.tables[0].columns[0]).toMatchObject({
        name: "id",
        isPrimaryKey: true,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates a plan with injectable planner dependencies", async () => {
    withAnthropicKey();
    const dir = mkdtempSync(join(tmpdir(), "popsynth-cli-"));
    const schemaPath = writeSqlFixture(dir);
    restoreDependencies = setCliDependencies({
      parseSchemaOrThrow: async () => schema,
      runMappingAgent: async () => plan,
    });

    try {
      const result = await captureOutput(() =>
        runCli([
          "plan",
          "--schema",
          schemaPath,
          "--schema-kind",
          "sql",
          "--theme",
          "Gotham logistics",
        ]),
      );

      expect(JSON.parse(result.stdout)).toMatchObject({
        theme: "Gotham logistics",
        generationOrder: ["users"],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses non-empty output directories unless forced", async () => {
    withAnthropicKey();
    const dir = mkdtempSync(join(tmpdir(), "popsynth-cli-"));
    const schemaPath = writeSqlFixture(dir);
    writeFileSync(join(dir, "existing.txt"), "keep");
    restoreDependencies = setCliDependencies(mockGenerateDependencies());

    await expect(
      runCli([
        "generate",
        "--schema",
        schemaPath,
        "--schema-kind",
        "sql",
        "--theme",
        "Gotham logistics",
        "--out",
        dir,
      ]),
    ).rejects.toThrow(/Output directory is not empty/);

    rmSync(dir, { recursive: true, force: true });
  });

  it("writes CSV files and a JSON manifest when forced", async () => {
    withAnthropicKey();
    const dir = mkdtempSync(join(tmpdir(), "popsynth-cli-"));
    const schemaPath = writeSqlFixture(dir);
    writeFileSync(join(dir, "existing.txt"), "keep");
    restoreDependencies = setCliDependencies(mockGenerateDependencies());

    try {
      const result = await captureOutput(() =>
        runCli([
          "generate",
          "--schema",
          schemaPath,
          "--schema-kind",
          "sql",
          "--theme",
          "Gotham logistics",
          "--out",
          dir,
          "--force",
          "--json",
        ]),
      );
      const manifest = JSON.parse(result.stdout);
      expect(manifest.files).toEqual([
        { filename: "users.csv", path: join(dir, "users.csv"), rows: 1 },
      ]);
      expect(readFileSync(join(dir, "users.csv"), "utf8")).toContain(
        "bruce@wayne.example",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function mockGenerateDependencies() {
  return {
    parseSchemaOrThrow: async () => schema,
    runMappingAgent: async () => plan,
    generateAllTables: async (
      _plan: GenerationPlan,
      _schema: SchemaIR,
      options?: GenerateOptions,
    ): Promise<GeneratedRecords> => {
      await options?.onEvent?.({
        type: "table-start",
        table: "users",
        rowCount: 1,
      });
      await options?.onEvent?.({
        type: "rows",
        table: "users",
        rows: [{ id: 1, email: "bruce@wayne.example" }],
      });
      await options?.onEvent?.({
        type: "table-complete",
        table: "users",
        rowCount: 1,
      });
      return { users: [{ id: 1, email: "bruce@wayne.example" }] };
    },
  };
}

function writeSqlFixture(dir: string): string {
  const schemaPath = join(dir, "schema.sql");
  writeFileSync(
    schemaPath,
    "CREATE TABLE users (id integer PRIMARY KEY, email varchar(254) UNIQUE NOT NULL);",
  );
  return schemaPath;
}

async function captureOutput(fn: () => Promise<void>): Promise<{
  stdout: string;
  stderr: string;
}> {
  let stdout = "";
  let stderr = "";
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  try {
    await fn();
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
  }

  return { stdout, stderr };
}

function withAnthropicKey(): void {
  const previous = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  restoreEnv = () => {
    if (previous === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previous;
  };
}
