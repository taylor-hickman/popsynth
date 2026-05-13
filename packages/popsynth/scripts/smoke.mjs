import { execFileSync } from "node:child_process";
import { mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pkgDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const tgz = execFileSync("npm", ["pack", "--silent"], {
  cwd: pkgDir,
  encoding: "utf8",
}).trim();
const tgzPath = join(pkgDir, tgz);
const workdir = mkdtempSync(join(tmpdir(), "popsynth-smoke-"));

execFileSync("npm", ["init", "-y"], { cwd: workdir, stdio: "ignore" });
execFileSync("npm", ["install", tgzPath, "--ignore-scripts"], {
  cwd: workdir,
  stdio: "inherit",
});
unlinkSync(tgzPath);

execFileSync("npx", ["popsynth", "--version"], {
  cwd: workdir,
  stdio: "inherit",
});

const schemaPath = join(workdir, "schema.sql");
writeFileSync(
  schemaPath,
  "CREATE TABLE users (id integer PRIMARY KEY, email varchar(254) UNIQUE NOT NULL);",
);
execFileSync(
  "npx",
  ["popsynth", "parse", "--schema", schemaPath, "--schema-kind", "sql"],
  { cwd: workdir, stdio: "inherit" },
);
