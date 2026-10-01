import { ToolInputError, wireSchema } from "@agntn/tools";
import type { ToolDefinition } from "@oh-my-pi/pi-coding-agent";
import { describe, expect, it, vi } from "vite-plus/test";

/** Compiled OMP injects no TUI barrel, so loading it has to fail the test. */
vi.mock("@oh-my-pi/pi-coding-agent/tui", () => {
  throw new Error("The OMP host does not inject the TUI barrel");
});

import templateExtension from "../packages/omp/extensions/template.ts";
import { APP_NAME_MAX_LENGTH, APP_NAME_PATTERN } from "../src/tool-contract.ts";
import { pathsTool } from "../src/tools.ts";
import {
  ompTestTheme as theme,
  ompToolContext,
  registerOmpExtension,
} from "./fixtures/omp-host.ts";

const CONTROL_BYTES = /[\u0000-\u001F\u007F-\u009F]/;

async function registerTemplateTool(): Promise<ToolDefinition> {
  return (await registerOmpExtension(templateExtension)).tool("template_paths");
}

function renderedText(component: unknown): string {
  return (component as { text: string }).text;
}

describe("omp template extension", () => {
  it("registers template_paths as a read-approval tool", async () => {
    const host = await registerOmpExtension(templateExtension);
    const tool = host.tool("template_paths");

    expect([...host.tools.keys()]).toEqual(["template_paths"]);
    expect(host.labels).toEqual(["Template"]);
    expect(tool.name).toBe("template_paths");
    expect(tool.label).toBe("Template Paths");
    expect(tool.approval).toBe("read");
  });

  it("hands OMP the shared schema and refuses what it rejects", async () => {
    const tool = await registerTemplateTool();
    const outcome = async (appName: string): Promise<string> =>
      Promise.resolve(
        tool.execute("call-1", { appName }, undefined, undefined, ompToolContext),
      ).then(
        () => "ran",
        (error: unknown) => (error instanceof ToolInputError ? "refused" : "failed"),
      );
    const longest = "a".repeat(APP_NAME_MAX_LENGTH);

    expect(tool.parameters).toEqual(wireSchema(pathsTool));
    expect(new RegExp(APP_NAME_PATTERN).test(longest)).toBe(true);
    expect(await outcome(longest)).toBe("ran");
    expect(await outcome(`${longest}a`)).toBe("refused");
    expect(await outcome("my.app")).toBe("refused");
  });

  it("executes against the library and returns structured details", async () => {
    const tool = await registerTemplateTool();

    const result = await tool.execute(
      "call-1",
      { appName: "vitest-app" },
      undefined,
      undefined,
      ompToolContext,
    );

    expect(result.content[0]?.type).toBe("text");
    const details = result.details as { config: string; data: string; cache: string };
    expect(details.config).toContain("vitest-app");
    expect(details.data).toContain("vitest-app");
    expect(details.cache).toContain("vitest-app");
  });

  it("fails the call on an app name the schema rejects", async () => {
    const tool = await registerTemplateTool();

    await expect(
      tool.execute("call-1", { appName: "my.app" }, undefined, undefined, ompToolContext),
    ).rejects.toThrow("Invalid arguments at /appName");
  });

  it.each([
    [false, undefined, "success:status.done"],
    [true, undefined, "muted:status.pending"],
    [true, 3, "frame-1"],
  ] as const)(
    "draws the call status with the host theme (partial=%s, frame=%s)",
    async (isPartial, spinnerFrame, icon) => {
      const tool = await registerTemplateTool();

      const text = renderedText(
        tool.renderCall?.(
          { appName: "my-app" },
          { expanded: false, isPartial, spinnerFrame },
          theme,
        ),
      );

      expect(text).toBe(`${icon} accent(Template Paths): muted(my-app)`);
    },
  );

  it("sanitizes model arguments in renderCall", async () => {
    const tool = await registerTemplateTool();
    const hostile = { appName: "\u001B]0;evil\u0007app\u001B[31mname\nnext" };

    const text = renderedText(
      tool.renderCall?.(hostile, { expanded: false, isPartial: false }, theme),
    );

    expect(text).not.toMatch(CONTROL_BYTES);
    expect(text).toBe("success:status.done accent(Template Paths): muted(appname next)");
  });

  it("replaces line separators and format characters in renderCall", async () => {
    const tool = await registerTemplateTool();
    const hostile = { appName: "safe\u2028forged\u2029line\u202Eevil\u200Btail\u{E0041}" };

    const text = renderedText(
      tool.renderCall?.(hostile, { expanded: false, isPartial: false }, theme),
    );

    expect(text).toBe(
      "success:status.done accent(Template Paths): muted(safe forged line evil tail)",
    );
  });

  it("cuts a long argument before sanitizing it", async () => {
    const tool = await registerTemplateTool();
    const started = performance.now();

    tool.renderCall?.(
      { appName: "\u001B]".repeat(100_000) },
      { expanded: false, isPartial: true },
      theme,
    );

    expect(performance.now() - started).toBeLessThan(500);
  });

  it("survives a numeric argument that violates the declared schema type", async () => {
    const tool = await registerTemplateTool();

    const text = renderedText(
      tool.renderCall?.({ appName: 42 }, { expanded: false, isPartial: true }, theme),
    );

    expect(text).toBe("muted:status.pending accent(Template Paths): muted(42)");
  });

  it("sanitizes result data in renderResult and keeps the read badge", async () => {
    const tool = await registerTemplateTool();
    const result = {
      content: [{ type: "text" as const, text: "ok" }],
      details: {
        config: "/home/user/.config/\u001B]8;;https://evil\u0007app",
        data: "/home/user/.local/share/app",
        cache: "/home/user/.cache/\u009Bapp",
      },
    };

    const text = renderedText(
      tool.renderResult?.(result, { expanded: false, isPartial: false }, theme),
    );

    expect(text).not.toMatch(CONTROL_BYTES);
    expect(text).toBe(
      "success:status.done accent(Template Paths) accent([read]) dim(config /home/user/.config/app | data /home/user/.local/share/app | cache /home/user/.cache/ app)",
    );
  });

  it("marks an error result with the error icon and no meta", async () => {
    const tool = await registerTemplateTool();
    const result = { content: [{ type: "text" as const, text: "boom" }], isError: true };

    const text = renderedText(
      tool.renderResult?.(result, { expanded: false, isPartial: false }, theme),
    );

    expect(text).toBe("error:status.error accent(Template Paths) accent([read])");
  });
});
