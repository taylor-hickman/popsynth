import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
for (const file of walk(distDir)) {
  if (!file.endsWith(".js") && !file.endsWith(".d.ts")) continue;
  const source = readFileSync(file, "utf8");
  const next = source.replace(
    /(from\s+["'])(\.{1,2}\/[^"']+?)(["'])/g,
    (_match, prefix, specifier, suffix) =>
      `${prefix}${withJsExtension(specifier)}${suffix}`,
  );
  if (next !== source) writeFileSync(file, next, "utf8");
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

function withJsExtension(specifier) {
  if (extname(specifier)) return specifier;
  return `${specifier}.js`;
}
