import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const switches = new Set(["CI", "FORCE_COLOR", "NO_COLOR", "NODE_DISABLE_COLORS", "TEST"]);
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
