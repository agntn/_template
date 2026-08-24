import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

import type { AgentToolResult, ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { Text } from "@oh-my-pi/pi-coding-agent";
import { renderStatusLine } from "@oh-my-pi/pi-coding-agent/tui";

import type * as TemplateTools from "../../../dist/tool-operations.d.mts";

const sourceModulePath = fileURLToPath(new URL("../../../src/tool-operations.ts", import.meta.url));
let toolOperationsPromise: Promise<typeof TemplateTools> | undefined;

/**
 * Loads the tool executors shared with the MCP server and the Pi extension,
 * so the tool answers stay identical across surfaces. Both specifiers stay
 * literal on purpose: OMP's compiled loader rewrites bare dependencies only
 * for imports it can see statically.
 */
function loadToolOperations(): Promise<typeof TemplateTools> {
  toolOperationsPromise ??= (
    existsSync(sourceModulePath)
      ? import("../../../src/tool-operations.ts")
      : import("../../../dist/tool-operations.mjs")
  ) as Promise<typeof TemplateTools>;

  return toolOperationsPromise;
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
    async execute(
      _toolCallId,
      params,
    ): Promise<AgentToolResult<TemplateTools.AppPaths | TemplateTools.PathsFailure>> {
      const { templatePaths } = await loadToolOperations();
      const { content, details } = templatePaths(params.appName);
      return { content, details };
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
      const resolved = paths && "config" in paths ? paths : undefined;

      return new Text(
        renderStatusLine(
          {
            icon: result.isError ? "error" : "done",
            title: "Template Paths",
            badge: { label: "read", color: "accent" },
            meta: resolved
              ? [
                  `config ${sanitizeTerminalText(resolved.config)}`,
                  `data ${sanitizeTerminalText(resolved.data)}`,
                  `cache ${sanitizeTerminalText(resolved.cache)}`,
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
