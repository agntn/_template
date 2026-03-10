import { homedir, platform } from "node:os";
import { join } from "node:path";

export interface AppPaths {
  /** Config files (settings, credentials) */
  config: string;
  /** Persistent data (databases, state) */
  data: string;
  /** Cache files (safe to delete) */
  cache: string;
}

/**
 * Resolve platform-standard directories for an application.
 *
 * - Linux/FreeBSD: XDG Base Directory (`$XDG_CONFIG_HOME`, `$XDG_DATA_HOME`, `$XDG_CACHE_HOME`)
 * - macOS: `~/Library/Application Support` and `~/Library/Caches`
 * - Windows: `%APPDATA%` and `%LOCALAPPDATA%`
 *
 * Each path can be overridden via `{APP_NAME_UPPER}_CONFIG_DIR`, `{APP_NAME_UPPER}_DATA_DIR`,
 * or `{APP_NAME_UPPER}_CACHE_DIR` environment variables.
 */
export function resolveAppPaths(appName: string): AppPaths {
  const envPrefix = appName.toUpperCase().replace(/-/g, "_");
  const home = homedir();
  const os = platform();

  return {
    config: process.env[`${envPrefix}_CONFIG_DIR`] || resolveConfig(os, home, appName),
    data: process.env[`${envPrefix}_DATA_DIR`] || resolveData(os, home, appName),
    cache: process.env[`${envPrefix}_CACHE_DIR`] || resolveCache(os, home, appName),
  };
}

function resolveConfig(os: string, home: string, name: string): string {
  if (os === "darwin") {
    return join(home, "Library", "Application Support", name);
  }
  if (os === "win32") {
    return join(process.env["APPDATA"] || join(home, "AppData", "Roaming"), name);
  }
  return join(process.env["XDG_CONFIG_HOME"] || join(home, ".config"), name);
}

function resolveData(os: string, home: string, name: string): string {
  if (os === "darwin") {
    return join(home, "Library", "Application Support", name);
  }
  if (os === "win32") {
    return join(process.env["LOCALAPPDATA"] || join(home, "AppData", "Local"), name, "data");
  }
  return join(process.env["XDG_DATA_HOME"] || join(home, ".local", "share"), name);
}

function resolveCache(os: string, home: string, name: string): string {
  if (os === "darwin") {
    return join(home, "Library", "Caches", name);
  }
  if (os === "win32") {
    return join(process.env["LOCALAPPDATA"] || join(home, "AppData", "Local"), name, "cache");
  }
  return join(process.env["XDG_CACHE_HOME"] || join(home, ".cache"), name);
}
