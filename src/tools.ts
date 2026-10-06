/** The template tools, declared once for every surface. Executors load on the first call. */

import { defineTool, Type, type ToolDefinition } from "@agntn/tools";
import { APP_NAME_MAX_LENGTH, APP_NAME_PATTERN } from "./tool-contract.ts";

type ToolOperations = typeof import("./tool-operations.ts");

let operations: Promise<ToolOperations> | undefined;

/**
 * Loads the executors once. A failed load isn't cached, so a broken `dist` doesn't stick.
 *
 * @returns {Promise<ToolOperations>} The executors.
 */
export function loadOperations(): Promise<ToolOperations> {
  operations ??= import("./tool-operations.ts").catch((error: unknown) => {
    operations = undefined;
    throw error;
  });
  return operations;
}

export const pathsTool = defineTool({
  name: "template_paths",
  title: "Template Paths",
  description:
    "Resolve platform-standard config, data, and cache directories for an application, honoring platform conventions, XDG variables, and app-specific overrides.",
  snippet: "Use template_paths to resolve platform-standard application directories.",
  guidelines: [
    "Pass the application's filesystem-safe name.",
    "The tool respects platform conventions, XDG variables, and app-specific directory overrides.",
  ],
  effect: "read",
  cli: { description: "Config, data and cache directories for an app", positional: ["appName"] },
  input: Type.Object(
    {
      appName: Type.String({
        description: "Filesystem-safe application name",
        minLength: 1,
        maxLength: APP_NAME_MAX_LENGTH,
        pattern: APP_NAME_PATTERN,
      }),
    },
    { additionalProperties: false },
  ),
  execute: async ({ appName }) => (await loadOperations()).templatePaths(appName),
});

export const templateTools: readonly ToolDefinition[] = [pathsTool];
