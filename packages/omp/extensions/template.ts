import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

import type { AgentToolResult, ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { Text } from "@oh-my-pi/pi-coding-agent";

import type * as TemplateTools from "../../../dist/tool-operations.d.mts";

const sourceModulePath = fileURLToPath(new URL("../../../src/tool-operations.ts", import.meta.url));
let toolOperationsPromise: Promise<typeof TemplateTools> | undefined;

/**
 * Loads the tool executors shared with the MCP server and the Pi extension,
 * so the tool answers stay identical across surfaces. Both specifiers stay
 * literal on purpose: OMP's compiled loader rewrites bare dependencies only
 * for imports it can see statically.
 *
 * @returns {Promise<typeof TemplateTools>} Shared tool operations module.
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
    .replaceAll(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replaceAll(/ +/g, " ")
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
    // The status line is drawn with the host theme on purpose: compiled OMP injects only the
    // package root, so a runtime import from `@oh-my-pi/pi-coding-agent/tui` would stop the
    // whole extension from loading.
    renderCall(args, options, theme) {
      const icon = options.isPartial
        ? options.spinnerFrame === undefined
          ? theme.styledSymbol("status.pending", "muted")
          : (theme.spinnerFrames[options.spinnerFrame % theme.spinnerFrames.length] ??
            theme.styledSymbol("status.running", "accent"))
        : theme.styledSymbol("status.done", "success");
      const description = sanitizeTerminalText(args.appName);
      const title = theme.fg("accent", "Template Paths");

      return new Text(
        `${icon} ${title}${description ? `: ${theme.fg("muted", description)}` : ""}`,
        0,
        0,
      );
    },
    renderResult(result, _options, theme) {
      const paths = result.details;
      const resolved = paths && "config" in paths ? paths : undefined;
      const icon = result.isError
        ? theme.styledSymbol("status.error", "error")
        : theme.styledSymbol("status.done", "success");
      const { bracketLeft, bracketRight } = theme.format;
      const badge = theme.fg("accent", `${bracketLeft}read${bracketRight}`);
      const meta = resolved
        ? ` ${theme.fg(
            "dim",
            [
              `config ${sanitizeTerminalText(resolved.config)}`,
              `data ${sanitizeTerminalText(resolved.data)}`,
              `cache ${sanitizeTerminalText(resolved.cache)}`,
            ].join(theme.sep.dot),
          )}`
        : "";

      return new Text(`${icon} ${theme.fg("accent", "Template Paths")} ${badge}${meta}`, 0, 0);
    },
  });
}
