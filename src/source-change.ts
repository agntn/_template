import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Newest ctime of `directory` and everything under it. ctime can't be backdated the way mtime can,
 * and a removed or renamed file still moves its parent's.
 * @param directory - Root of the tree.
 * @returns {number} The newest ctime in milliseconds.
 */
export function lastSourceChange(directory: string): number {
  let newest = statSync(directory).ctimeMs;
  for (const entry of readdirSync(directory, { encoding: "utf8", recursive: true })) {
    const stats = statSync(join(directory, entry), { throwIfNoEntry: false });
    if (stats && stats.ctimeMs > newest) newest = stats.ctimeMs;
  }
  return newest;
}

/**
 * Snapshots `directory` now and returns a check that throws once anything under it changed. A
 * server running `src/` keeps its loaded modules cached, so a lazy import of a pulled file meets
 * old exports and fails with an error that points nowhere near the cause.
 * @param directory - The source tree the server loads from.
 * @returns {() => void} The check to run before each tool call.
 */
export function sourceChangeGuard(directory: string): () => void {
  const loaded = lastSourceChange(directory);
  return () => {
    if (lastSourceChange(directory) !== loaded) {
      throw new Error("src/ changed under this server, restart it to load the new code");
    }
  };
}
