import { defineBuildConfig } from "obuild/config";

export default defineBuildConfig({
  entries: [
    {
      /** One bundle, so every entry shares module-level state with the MCP server. */
      type: "bundle",
      input: ["./src/index.ts", "./src/cli.ts", "./src/ai.ts", "./src/mcp.ts", "./src/tools.ts"],
      /** No maps: the JS ones point at the wrong lines, the d.ts ones at a src/ we don't ship. */
      dts: { sourcemap: false },
    },
  ],
});
