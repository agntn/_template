import oxfmt from "@agntn/ox/oxfmt";
import oxlint from "@agntn/ox/oxlint";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: { ...oxfmt, ignorePatterns: [] },
  lint: { ...oxlint, rules: { ...oxlint.rules }, ignorePatterns: [] },
  /**
   * One bundle, five inputs: the entries share their chunks and therefore any module-level state.
   * Separate bundles would each carry their own copy, so state touched through the package
   * entrypoint would be invisible to the MCP server (and vice versa). Chunks keep stable names
   * under `_chunks`, as obuild wrote them.
   */
  pack: {
    entry: {
      index: "src/index.ts",
      cli: "src/cli.ts",
      ai: "src/ai.ts",
      mcp: "src/mcp.ts",
      "tool-operations": "src/tool-operations.ts",
    },
    dts: true,
    format: "esm",
    platform: "node",
    sourcemap: true,
    hash: false,
    outputOptions: {
      chunkFileNames: "_chunks/[name].mjs",
      /* JSDoc ships once, in the declarations; the runtime files keep only legal and annotation comments. */
      comments: { jsdoc: false },
    },
  },
});
