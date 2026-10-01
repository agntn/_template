/** Vercel AI SDK tool surface over the shared template tool definitions. */

import { toAiTool, type AiToolOutput } from "@agntn/tools/ai";
import type { Tool } from "ai";
import type { AppPaths } from "./tool-operations.ts";
import { pathsTool } from "./tools.ts";

export const templatePathsTool: Tool<{ appName: string }, AiToolOutput<AppPaths>> = toAiTool(
  pathsTool,
);

/** Every template tool, keyed by the name MCP, Pi and OMP use for it. */
export const templateAiTools = {
  template_paths: templatePathsTool,
};
