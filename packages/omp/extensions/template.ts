import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

import type { AgentToolResult, ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { Text } from "@oh-my-pi/pi-coding-agent";
import { renderStatusLine } from "@oh-my-pi/pi-coding-agent/tui";

import type * as TemplateModule from "../../../dist/index.d.mts";

const sourceModuleUrl = new URL("../../../src/index.ts", import.meta.url);
const distributionModuleUrl = new URL("../../../dist/index.mjs", import.meta.url);
let templateModulePromise: Promise<typeof TemplateModule> | undefined;

function loadLibrary(): Promise<typeof TemplateModule> {
  templateModulePromise ??= import(
    existsSync(fileURLToPath(sourceModuleUrl)) ? sourceModuleUrl.href : distributionModuleUrl.href
  ) as Promise<typeof TemplateModule>;

  return templateModulePromise;
}

// Renderer interpolations cross the terminal trust boundary: model arguments and
// external values may carry ANSI/OSC escape sequences or raw C0/C1 control bytes
// that OMP's Text component passes through to the terminal unchanged. String()
// first, because hostile JSON is not bound by the declared parameter types.
export function sanitizeTerminalText(value: unknown): string {
  return stripVTControlCharacters(String(value))
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

export default function templateExtension(pi: ExtensionAPI): void {
  // OMP validates tool parameters with its own TypeBox build, so schemas must
  // come from the host-injected facade rather than a standalone typebox import.
  const { Type } = pi.typebox;
  pi.setLabel("Template");

  pi.registerTool({
    name: "template_paths",
    label: "Template Paths",
    description: "Resolve platform-standard config, data, and cache directories for an application",
    parameters: Type.Object({
      appName: Type.String({
        description: "Filesystem-safe application name",
        minLength: 1,
        maxLength: 100,
        pattern: "^[A-Za-z0-9][A-Za-z0-9_-]*$",
      }),
    }),
    approval: "read",
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
    renderCall(args, options, theme) {
      const icon = options.isPartial
        ? options.spinnerFrame === undefined
          ? "pending"
          : "running"
        : "done";

      return new Text(
        renderStatusLine(
          {
            icon,
            spinnerFrame: options.spinnerFrame,
            title: "Template Paths",
            description: sanitizeTerminalText(args.appName),
          },
          theme,
        ),
        0,
        0,
      );
    },
    renderResult(result, _options, theme) {
      const paths = result.details;

      return new Text(
        renderStatusLine(
          {
            icon: result.isError ? "error" : "done",
            title: "Template Paths",
            badge: { label: "read", color: "accent" },
            meta: paths
              ? [
                  `config ${sanitizeTerminalText(paths.config)}`,
                  `data ${sanitizeTerminalText(paths.data)}`,
                  `cache ${sanitizeTerminalText(paths.cache)}`,
                ]
              : undefined,
          },
          theme,
        ),
        0,
        0,
      );
    },
  });
}
