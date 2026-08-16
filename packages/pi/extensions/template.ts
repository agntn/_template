import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { AgentToolResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import type * as TemplateModule from "../../../src/index.ts";

const sourceModuleUrl = new URL("../../../src/index.ts", import.meta.url);
const distributionModuleUrl = new URL("../../../dist/index.mjs", import.meta.url);
let templateModulePromise: Promise<typeof TemplateModule> | undefined;

function loadLibrary(): Promise<typeof TemplateModule> {
  templateModulePromise ??= import(
    existsSync(fileURLToPath(sourceModuleUrl)) ? sourceModuleUrl.href : distributionModuleUrl.href
  ) as Promise<typeof TemplateModule>;

  return templateModulePromise;
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
        pattern: "^[A-Za-z0-9][A-Za-z0-9._-]*$",
      }),
    }),
    async execute(_toolCallId, params): Promise<AgentToolResult<TemplateModule.AppPaths>> {
      const { resolveAppPaths } = await loadLibrary();
      const paths = resolveAppPaths(params.appName);

      return {
        content: [
          {
            type: "text",
            text: `Config: ${paths.config}\nData: ${paths.data}\nCache: ${paths.cache}`,
          },
        ],
        details: paths,
      };
    },
  });
}
