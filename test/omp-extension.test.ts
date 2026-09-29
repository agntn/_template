import { describe, expect, it, vi } from "vite-plus/test";
import type * as typebox from "@oh-my-pi/omptype/typebox";
import type { ToolDefinition } from "@oh-my-pi/pi-coding-agent";

// Compiled OMP injects only the package root into extensions, so the renderers run
// against a capturing Text and the TUI barrel must stay off the load path.
vi.mock("@oh-my-pi/pi-coding-agent", () => ({
  Text: class {
    readonly text: string;

    constructor(text: string) {
      this.text = text;
    }
  },
}));
vi.mock("@oh-my-pi/pi-coding-agent/tui", () => {
  throw new Error("The OMP host does not inject the TUI barrel");
});

import templateExtension, { sanitizeTerminalText } from "../packages/omp/extensions/template.ts";
import { APP_NAME_MAX_LENGTH, APP_NAME_PATTERN } from "../src/tool-operations.ts";
import {
  ompTestTheme as theme,
  ompToolContext,
  registerOmpExtension,
} from "./fixtures/omp-host.ts";

const CONTROL_BYTES = /[\u0000-\u001F\u007F-\u009F]/;

function registerTemplateTool(): ToolDefinition {
  return registerOmpExtension(templateExtension).tool("template_paths");
}

function renderedText(component: unknown): string {
  return (component as { text: string }).text;
}

describe("sanitizeTerminalText", () => {
  it("strips ANSI, OSC, C0, and C1 sequences", () => {
    const hostile = "\u001B]0;evil\u0007safe\u001B[31mname\u009B1mtail\u0000end";

    const clean = sanitizeTerminalText(hostile);

    expect(clean).not.toMatch(CONTROL_BYTES);
    expect(clean).not.toContain("evil");
    expect(clean).not.toContain("31m");
    expect(clean).toContain("safe");
    expect(clean).toContain("end");
  });

  it("coerces non-string values crossing the runtime boundary", () => {
    expect(sanitizeTerminalText(42)).toBe("42");
  });
});

describe("omp template extension", () => {
  it("registers template_paths as a read-approval tool", () => {
    const host = registerOmpExtension(templateExtension);
    const tool = host.tool("template_paths");

    expect([...host.tools.keys()]).toEqual(["template_paths"]);
    expect(host.labels).toEqual(["Template"]);
    expect(tool.name).toBe("template_paths");
    expect(tool.label).toBe("Template Paths");
    expect(tool.approval).toBe("read");
  });

  it("keeps the restated schema aligned with the executor's name contract", () => {
    const tool = registerTemplateTool();
    const accepts = (value: unknown): boolean =>
      (tool.parameters as unknown as typebox.TSchema).safeParse(value).success;
    const longest = "a".repeat(APP_NAME_MAX_LENGTH);

    // The parameters are declared before the executor can be loaded, so the
    // restated pattern and length have to match what the executor enforces.
    expect(new RegExp(APP_NAME_PATTERN).test(longest)).toBe(true);
    expect(accepts({ appName: longest })).toBe(true);
    expect(accepts({ appName: `${longest}a` })).toBe(false);
    expect(accepts({ appName: "my.app" })).toBe(false);
  });

  it("executes against the library and returns structured details", async () => {
    const tool = registerTemplateTool();

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

  it("fails the call on an app name the executor rejects", async () => {
    const tool = registerTemplateTool();

    await expect(
      tool.execute("call-1", { appName: "my.app" }, undefined, undefined, ompToolContext),
    ).rejects.toThrow('Invalid app name: "my.app"');
  });

  it.each([
    [false, undefined, "success:status.done"],
    [true, undefined, "muted:status.pending"],
    [true, 3, "frame-1"],
  ] as const)(
    "draws the call status with the host theme (partial=%s, frame=%s)",
    (isPartial, spinnerFrame, icon) => {
      const tool = registerTemplateTool();

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

  it("sanitizes model arguments in renderCall", () => {
    const tool = registerTemplateTool();
    const hostile = { appName: "\u001B]0;evil\u0007app\u001B[31mname\nnext" };

    const text = renderedText(
      tool.renderCall?.(hostile, { expanded: false, isPartial: false }, theme),
    );

    expect(text).not.toMatch(CONTROL_BYTES);
    expect(text).toBe("success:status.done accent(Template Paths): muted(appname next)");
  });

  it("survives a numeric argument that violates the declared schema type", () => {
    const tool = registerTemplateTool();

    const text = renderedText(
      tool.renderCall?.({ appName: 42 }, { expanded: false, isPartial: true }, theme),
    );

    expect(text).toBe("muted:status.pending accent(Template Paths): muted(42)");
  });

  it("sanitizes result data in renderResult and keeps the read badge", () => {
    const tool = registerTemplateTool();
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

  it("marks an error result with the error icon and no meta", () => {
    const tool = registerTemplateTool();
    const result = { content: [{ type: "text" as const, text: "boom" }], isError: true };

    const text = renderedText(
      tool.renderResult?.(result, { expanded: false, isPartial: false }, theme),
    );

    expect(text).toBe("error:status.error accent(Template Paths) accent([read])");
  });
});
