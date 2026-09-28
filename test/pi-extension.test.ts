import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { Value } from "typebox/value";

import { APP_NAME_MAX_LENGTH, APP_NAME_PATTERN } from "../src/tool-operations.ts";
import { loadPiExtension } from "./fixtures/pi-host.ts";

const extensionPath = fileURLToPath(
  new URL("../packages/pi/extensions/template.ts", import.meta.url),
);

describe("pi template extension", () => {
  it("registers template_paths and nothing else", async () => {
    const host = await loadPiExtension(extensionPath);

    expect([...host.tools.keys()]).toEqual(["template_paths"]);
  });

  it("keeps the restated schema aligned with the executor's name contract", async () => {
    const tool = (await loadPiExtension(extensionPath)).tool("template_paths");
    const accepts = (value: unknown): boolean => Value.Check(tool.parameters, value);
    const longest = "a".repeat(APP_NAME_MAX_LENGTH);

    // The parameters are declared before the executor can be loaded, so the
    // restated pattern and length have to match what the executor enforces.
    expect(new RegExp(APP_NAME_PATTERN).test(longest)).toBe(true);
    expect(accepts({ appName: longest })).toBe(true);
    expect(accepts({ appName: `${longest}a` })).toBe(false);
    expect(accepts({ appName: "my.app" })).toBe(false);
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
});
