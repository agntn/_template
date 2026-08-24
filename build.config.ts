import { defineBuildConfig } from "obuild/config";

/**
 * One bundle, five inputs: the entries share their chunks and therefore any
 * module-level state. Separate bundles would each carry their own copy, so
 * state touched through the package entrypoint would be invisible to the MCP
 * server (and vice versa).
 */
export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: [
        "./src/index.ts",
        "./src/cli.ts",
        "./src/ai.ts",
        "./src/mcp.ts",
        "./src/tool-operations.ts",
      ],
    },
  ],
});
