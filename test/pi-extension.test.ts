import { fileURLToPath } from "node:url";

import { wireSchema } from "@agntn/tools";
import { describe, expect, it } from "vite-plus/test";

import { APP_NAME_MAX_LENGTH, APP_NAME_PATTERN } from "../src/tool-contract.ts";
import { pathsTool } from "../src/tools.ts";
import { loadPiExtension } from "./fixtures/pi-host.ts";

const extensionPath = fileURLToPath(new URL("../extensions/pi/template.ts", import.meta.url));

describe("pi template extension", () => {
  it("registers template_paths and nothing else", async () => {
    const host = await loadPiExtension(extensionPath);

    expect([...host.tools.keys()]).toEqual(["template_paths"]);
  });

  it("hands Pi the shared schema and refuses what it rejects", async () => {
    const host = await loadPiExtension(extensionPath);
    const tool = host.tool("template_paths");
    const outcome = async (appName: string): Promise<string> =>
      Promise.resolve(tool.execute("call-1", { appName }, undefined, undefined, host.context)).then(
        () => "ran",
        (error: unknown) =>
          error instanceof Error && error.message.startsWith("Invalid arguments")
            ? "refused"
            : "failed",
      );
    const longest = "a".repeat(APP_NAME_MAX_LENGTH);

    expect(tool.parameters).toEqual(wireSchema(pathsTool));
    expect(new RegExp(APP_NAME_PATTERN).test(longest)).toBe(true);
    expect(await outcome(longest)).toBe("ran");
    expect(await outcome(`${longest}a`)).toBe("refused");
    expect(await outcome("my.app")).toBe("refused");
  });

  it("executes through the shared executor and returns structured details", async () => {
    const host = await loadPiExtension(extensionPath);

    const result = await host
      .tool("template_paths")
      .execute("call-1", { appName: "pi-vitest-app" }, undefined, undefined, host.context);

    expect(result.content[0]?.type).toBe("text");
    const details = result.details as { config: string; data: string; cache: string };
    expect(details.config).toContain("pi-vitest-app");
    expect(details.data).toContain("pi-vitest-app");
    expect(details.cache).toContain("pi-vitest-app");
  });

  it("fails the call on an app name the schema rejects", async () => {
    const host = await loadPiExtension(extensionPath);

    // Pi records every returned value as a successful call; only a throw fails it.
    await expect(
      host
        .tool("template_paths")
        .execute("call-1", { appName: "my.app" }, undefined, undefined, host.context),
    ).rejects.toThrow("Invalid arguments at /appName");
  });
});
