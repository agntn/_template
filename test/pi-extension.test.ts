import { describe, expect, it } from "vitest";
import type { TSchema } from "typebox";
import { Value } from "typebox/value";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import templateExtension from "../packages/pi/extensions/template.ts";
import { APP_NAME_MAX_LENGTH, APP_NAME_PATTERN } from "../src/tool-operations.ts";

interface RegisteredTool {
  name: string;
  parameters: TSchema;
  execute(
    toolCallId: string,
    params: { appName: string },
  ): Promise<{ content: Array<{ type: string; text: string }>; details: unknown }>;
}

function registerTemplateTool(): RegisteredTool {
  const tools: RegisteredTool[] = [];
  const host = {
    registerTool: (tool: RegisteredTool) => {
      tools.push(tool);
    },
  } as unknown as ExtensionAPI;

  templateExtension(host);
  expect(tools).toHaveLength(1);
  return tools[0] as RegisteredTool;
}

describe("pi template extension", () => {
  it("keeps the restated schema aligned with the executor's name contract", () => {
    const tool = registerTemplateTool();
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
    const tool = registerTemplateTool();

    const result = await tool.execute("call-1", { appName: "pi-vitest-app" });

    expect(result.content[0]?.type).toBe("text");
    const details = result.details as { config: string; data: string; cache: string };
    expect(details.config).toContain("pi-vitest-app");
    expect(details.data).toContain("pi-vitest-app");
    expect(details.cache).toContain("pi-vitest-app");
  });
});
