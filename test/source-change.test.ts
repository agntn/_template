import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { sourceChangeGuard } from "../src/source-change.ts";

const trees: string[] = [];
const refused = "src/ changed under this server, restart it to load the new code";

/**
 * A source tree with one nested module and a guard snapshotted over it.
 * @returns {{ check: () => void, file: string, tree: string }} The guard, the module and the root.
 */
function guarded() {
  const tree = mkdtempSync(join(tmpdir(), "template-ts-source-"));
  trees.push(tree);
  mkdirSync(join(tree, "commands"));
  const file = join(tree, "commands/mcp.ts");
  writeFileSync(file, "export {};\n");
  return { check: sourceChangeGuard(tree), file, tree };
}

/** Lets the clock move on, so a change can't share the snapshot's ctime. */
async function later() {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

afterEach(() => {
  for (const tree of trees.splice(0)) rmSync(tree, { recursive: true, force: true });
});

describe("sourceChangeGuard", () => {
  it("passes while the tree stays as it was", async () => {
    const { check } = guarded();
    await later();

    expect(check).not.toThrow();
  });

  it("refuses once a nested file changes", async () => {
    const { check, file } = guarded();
    await later();
    writeFileSync(file, "export const added = 1;\n");

    expect(check).toThrow(refused);
  });

  it("refuses a change that kept its old mtime", async () => {
    const { check, file } = guarded();
    await later();
    writeFileSync(file, "export const added = 1;\n");
    utimesSync(file, new Date(0), new Date(0));

    expect(check).toThrow(refused);
  });

  it("refuses once a file goes away", async () => {
    const { check, file } = guarded();
    await later();
    rmSync(file);

    expect(check).toThrow(refused);
  });

  it("refuses once a file comes in", async () => {
    const { check, tree } = guarded();
    await later();
    writeFileSync(join(tree, "added.ts"), "export {};\n");

    expect(check).toThrow(refused);
  });
});
