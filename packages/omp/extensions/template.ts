import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { registerOmpTools, type OmpResultView } from "@agntn/tools/omp";
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

import type * as TemplateTools from "../../../dist/tools.d.mts";

/** Longest name on the status line, cut before `sanitizeLine`, which is slow on long escapes. */
const PREVIEW_LENGTH = 100;

const sourceModulePath = fileURLToPath(new URL("../../../src/tools.ts", import.meta.url));

/**
 * Both specifiers stay literal: compiled OMP resolves bare imports only where it sees them.
 *
 * @returns {Promise<typeof TemplateTools>} The definitions and the executor loader.
 */
function loadTools(): Promise<typeof TemplateTools> {
  return (
    existsSync(sourceModulePath)
      ? import("../../../src/tools.ts")
      : import("../../../dist/tools.mjs")
  ) as Promise<typeof TemplateTools>;
}

/**
 * Lists the three resolved directories, or nothing for a result without them.
 *
 * @param result - Tool result from the host.
 * @returns {string[]} One entry per directory.
 */
function describePaths(result: OmpResultView): string[] {
  const { details } = result;
  if (typeof details !== "object" || details === null || !("config" in details)) return [];
  const { config, data, cache } = details as { config?: unknown; data?: unknown; cache?: unknown };
  return [`config ${String(config)}`, `data ${String(data)}`, `cache ${String(cache)}`];
}

/**
 * Registers the template tools; the executors load on the first call.
 *
 * @param pi - OMP extension API supplied by the host.
 */
export default async function templateExtension(pi: ExtensionAPI): Promise<void> {
  pi.setLabel("Template");
  const { templateTools } = await loadTools();
  registerOmpTools(pi, templateTools, {
    // Compiled OMP injects no `/tui`, so the extension imports nothing from the host at runtime.
    Text: pi.pi.Text,
    renderers: {
      template_paths: {
        describeCall: (args) => String(args["appName"]).slice(0, PREVIEW_LENGTH),
        describeResult: describePaths,
      },
    },
  });
}
