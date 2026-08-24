import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { AgentToolResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import type * as TemplateTools from "../../../dist/tool-operations.d.mts";

const sourceModuleUrl = new URL("../../../src/tool-operations.ts", import.meta.url);
const distributionModuleUrl = new URL("../../../dist/tool-operations.mjs", import.meta.url);
let toolOperationsPromise: Promise<typeof TemplateTools> | undefined;

/**
 * Loads the tool executors shared with the MCP server and the OMP extension,
 * so the tool answers stay identical across surfaces.
 */
function loadToolOperations(): Promise<typeof TemplateTools> {
  toolOperationsPromise ??= import(
    existsSync(fileURLToPath(sourceModuleUrl)) ? sourceModuleUrl.href : distributionModuleUrl.href
  ) as Promise<typeof TemplateTools>;

  return toolOperationsPromise;
}

export default function templateExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "template_paths",
    label: "Template Paths",
    description: "Resolve platform-standard config, data, and cache directories for an application",
    promptSnippet: "Use template_paths to resolve platform-standard application directories.",
    promptGuidelines: [
      "Pass the application's filesystem-safe name.",
      "The tool respects platform conventions, XDG variables, and app-specific directory overrides.",
    ],
    parameters: Type.Object({
      appName: Type.String({
        description: "Filesystem-safe application name",
        minLength: 1,
        maxLength: 100,
        pattern: "^[A-Za-z0-9][A-Za-z0-9_-]*$",
      }),
    }),
    async execute(
      _toolCallId,
      params,
    ): Promise<AgentToolResult<TemplateTools.AppPaths | TemplateTools.PathsFailure>> {
      const { templatePaths } = await loadToolOperations();
      const { content, details } = templatePaths(params.appName);
      return { content, details };
    },
  });
}
