import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "popsynth/core": fileURLToPath(
        new URL("./packages/popsynth/src/core/index.ts", import.meta.url),
      ),
      popsynth: fileURLToPath(
        new URL("./packages/popsynth/src/index.ts", import.meta.url),
      ),
    },
  },
});
