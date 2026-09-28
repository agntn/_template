import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const switches = new Set([
  "CI",
  "FORCE_COLOR",
  "NO_COLOR",
  "NODE_DISABLE_COLORS",
  "TEMPLATE_TS_DIST",
  "TEST",
]);
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !switches.has(key))),
  TERM: "xterm-256color",
};

function run(...args: readonly string[]) {
  const { status, stderr, stdout } = spawnSync(process.execPath, ["src/cli.ts", ...args], {
    encoding: "utf8",
    env,
  });
  return { code: status, stderr, stdout };
}

describe("template-ts CLI", () => {
  it("prints the usage and citty's errors without colors into a pipe", () => {
    const help = run("--help");
    const usage = run("hello", "--help");
    const unknown = run("nope");

    expect(help.stdout).toContain("USAGE template-ts hello|mcp");
    expect(usage.stdout).toContain("NAME    Name to greet");
    expect(unknown).toMatchObject({ code: 1, stderr: "Unknown command nope\n" });
    for (const output of [help, usage, unknown]) {
      expect(output.stdout + output.stderr).not.toContain("\u001B");
    }
  });
});

const root = fileURLToPath(new URL("..", import.meta.url));

/** Prints every module URL the child loaded to stderr as it exits. */
const recordLoads = `data:text/javascript,${encodeURIComponent(`
  import { registerHooks } from "node:module";
  const loaded = [];
  registerHooks({
    load(url, context, nextLoad) {
      loaded.push(url);
      return nextLoad(url, context);
    },
  });
  process.on("exit", () => process.stderr.write("\\nLOADED " + JSON.stringify(loaded) + "\\n"));
`)}`;

const initialize = `${JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "template-test", version: "1.0.0" },
  },
})}\n`;

/**
 * Runs `mcp` from a built bin, answers one initialize request and tells where the server came
 * from. stdin closes after the request, so the server exits on its own.
 * @param base - Package root the bin sits in.
 * @param extraEnv - Environment on top of the shared one.
 * @returns {{ code: number | null, from: string, name: string | undefined, stderr: string }} The
 * exit code, where the server came from, the server name from the reply and stderr.
 */
function serve(base: string, extraEnv: Readonly<Record<string, string>> = {}) {
  const { status, stderr, stdout } = spawnSync(
    process.execPath,
    ["--import", recordLoads, join(base, "dist/cli.mjs"), "mcp"],
    { encoding: "utf8", env: { ...env, ...extraEnv }, input: initialize, timeout: 20_000 },
  );
  const marker = stderr.lastIndexOf("\nLOADED ");
  const loaded: unknown = marker === -1 ? [] : JSON.parse(stderr.slice(marker + 8));
  const urls = Array.isArray(loaded) ? loaded.filter((url) => typeof url === "string") : [];
  const source = urls.includes(pathToFileURL(join(base, "src/mcp.ts")).href);
  const bundle = urls.includes(pathToFileURL(join(base, "dist/_chunks/mcp.mjs")).href);
  let from: "bundle" | "source" | "unknown" = "unknown";
  if (source && !bundle) from = "source";
  if (bundle && !source) from = "bundle";
  const name = /"serverInfo":\{"name":"([^"]+)"/.exec(stdout)?.[1];
  return { code: status, from, name, stderr };
}

/**
 * A run that answered the initialize request.
 * @param from - Where the server has to come from.
 * @returns {{ code: number, from: string, name: string }} The fields `serve` has to match.
 */
function served(from: "bundle" | "source") {
  return { code: 0, from, name: "template-ts" };
}

describe.skipIf(!existsSync(join(root, "dist/cli.mjs")))(
  "template-ts mcp from the built bin",
  () => {
    it("serves the live source inside a checkout", () => {
      expect(serve(root)).toMatchObject(served("source"));
    });

    it("keeps the bundle under TEMPLATE_TS_DIST=1", () => {
      expect(serve(root, { TEMPLATE_TS_DIST: "1" })).toMatchObject(served("bundle"));
    });

    it("keeps the bundle when the package sits under node_modules", () => {
      // Node refuses to strip types there, so a copy that ships `src` still takes the bundle.
      const cache = join(root, "node_modules/.cache");
      mkdirSync(cache, { recursive: true });
      const nested = mkdtempSync(join(cache, "template-ts-cli-"));
      try {
        for (const entry of ["dist", "src", "package.json"]) {
          cpSync(join(root, entry), join(nested, entry), { recursive: true });
        }
        expect(serve(nested)).toMatchObject(served("bundle"));
      } finally {
        rmSync(nested, { recursive: true, force: true });
      }
    });

    it("keeps the bundle in a package that ships no src", () => {
      const packaged = mkdtempSync(join(tmpdir(), "template-ts-cli-"));
      try {
        for (const entry of ["dist", "packages", "package.json"]) {
          cpSync(join(root, entry), join(packaged, entry), { recursive: true });
        }
        symlinkSync(join(root, "node_modules"), join(packaged, "node_modules"), "dir");
        expect(serve(packaged)).toMatchObject(served("bundle"));
      } finally {
        rmSync(packaged, { recursive: true, force: true });
      }
    });
  },
);
