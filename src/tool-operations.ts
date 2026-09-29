/**
 * Tool executors shared by the MCP server and the Pi and OMP extensions.
 *
 * Each executor returns the text a caller reads plus the structured details the
 * agent harnesses attach to the call. An MCP client sees only the text, so every
 * fact needed for a follow-up call has to be in it.
 */

import { resolveAppPaths } from "./index.ts";
import type { AppPaths } from "./index.ts";

export type { AppPaths };

/**
 * Text for the model plus details for the harness, shared by every tool surface.
 * A failure throws instead: Pi records every returned value as a successful call.
 */
export interface ToolResult<Details> {
  content: Array<{ type: "text"; text: string }>;
  details: Details;
}

/** One name contract for every surface; the schemas repeat it, the executor enforces it. */
export const APP_NAME_PATTERN = "^[A-Za-z0-9][A-Za-z0-9_-]*$";
export const APP_NAME_MAX_LENGTH = 100;

const appNamePattern = new RegExp(APP_NAME_PATTERN);

/**
 * Resolves the platform-standard config, data, and cache directories for an app.
 *
 * The name check runs here, not only in the surface schemas: a host is free to
 * skip schema validation, and a dot in the name would derive an environment
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
