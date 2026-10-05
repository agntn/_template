import type { ToolDefinition } from "@agntn/tools";
import { createMcpServer as createToolServer } from "@agntn/tools/mcp";
import type { Server } from "@modelcontextprotocol/server";
import { sourceChangeGuard } from "./source-change.ts";
import { templateTools } from "./tools.ts";
import { version } from "./version.ts";

/**
 * Creates an unconnected MCP server exposing the template tools. Run from `src/`, it refuses calls
 * once that tree changes, since the bundle can't mix versions and the source can.
 *
 * @returns {Server} Unconnected MCP server.
 */
export function createMcpServer(): Server {
  if (!import.meta.url.endsWith(".ts")) {
    return createToolServer({ name: "template-ts", version }, templateTools);
  }
  const check = sourceChangeGuard(import.meta.dirname);
  const tools = templateTools.map((tool): ToolDefinition => ({
    ...tool,
    execute: (input, context) => {
      check();
      return tool.execute(input, context);
    },
  }));
  return createToolServer({ name: "template-ts", version }, tools);
}
