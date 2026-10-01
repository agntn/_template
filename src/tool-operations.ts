/**
 * Tool executors behind the definitions in `tools.ts`, loaded on the first call.
 *
 * Each executor returns the text a caller reads plus the structured details the
 * agent harnesses attach to the call. An MCP client sees only the text, so every
 * fact needed for a follow-up call has to be in it.
 */

import { resolveAppPaths } from "./index.ts";
import type { AppPaths } from "./index.ts";
import { APP_NAME_MAX_LENGTH, APP_NAME_PATTERN } from "./tool-contract.ts";

export type { AppPaths };

/**
 * Text for the model plus details for the harness, shared by every tool surface.
 * A failure throws instead: Pi records every returned value as a successful call.
 */
export interface ToolResult<Details> {
  content: Array<{ type: "text"; text: string }>;
  details: Details;
}

const appNamePattern = new RegExp(APP_NAME_PATTERN);

/**
 * Resolves the platform-standard config, data, and cache directories for an app.
 *
 * The name check runs here, not only in the schema: a caller can reach the
 * executor without it, and a dot in the name would derive an environment
 * override variable (`MY.APP_CONFIG_DIR`) a regular shell cannot export.
 *
 * @param appName - Filesystem-safe application name.
 * @returns {ToolResult<AppPaths>} Resolved paths.
 * @throws {Error} When the name breaks the contract.
 */
export function templatePaths(appName: string): ToolResult<AppPaths> {
  if (appName.length > APP_NAME_MAX_LENGTH || !appNamePattern.test(appName)) {
    throw new Error(
      `Invalid app name: ${JSON.stringify(appName)}. Use letters, digits, "_" or "-", starting with a letter or digit.`,
    );
  }

  const paths = resolveAppPaths(appName);
  return {
    content: [
      {
        type: "text",
        text: `Config: ${paths.config}\nData: ${paths.data}\nCache: ${paths.cache}`,
      },
    ],
    details: paths,
  };
}
