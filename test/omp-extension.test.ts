import { describe, expect, it, vi } from "vitest";
import * as typebox from "@oh-my-pi/omptype/typebox";
import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
  ToolDefinition,
} from "@oh-my-pi/pi-coding-agent";

// The host serves these modules to loaded extensions at runtime; under vitest the
// renderers are exercised against capturing stand-ins instead of the OMP TUI.
vi.mock("@oh-my-pi/pi-coding-agent", () => ({
  Text: class {
    constructor(
      readonly text: string,
      readonly paddingX?: number,
      readonly paddingY?: number,
    ) {}
  },
}));
vi.mock("@oh-my-pi/pi-coding-agent/tui", () => ({
  renderStatusLine: (options: unknown) => JSON.stringify(options),
}));

import templateExtension, { sanitizeTerminalText } from "../packages/omp/extensions/template.ts";
import { APP_NAME_MAX_LENGTH, APP_NAME_PATTERN } from "../src/tool-operations.ts";

const CONTROL_BYTES = /[\u0000-\u001F\u007F-\u009F]/;
const theme = {} as unknown as Theme;
const ctx = {} as unknown as ExtensionContext;

function registerTemplateTool(): ToolDefinition {
  const tools: ToolDefinition[] = [];
  const host = {
    typebox,
    setLabel: () => {},
    registerTool: (tool: ToolDefinition) => {
      tools.push(tool);
    },
  } as unknown as ExtensionAPI;

  templateExtension(host);
  expect(tools).toHaveLength(1);
  return tools[0] as ToolDefinition;
}

function renderedText(component: unknown): string {
  return (component as { text: string }).text;
}

describe("sanitizeTerminalText", () => {
  it("strips ANSI, OSC, C0, and C1 sequences", () => {
    const hostile = "\u001b]0;evil\u0007safe\u001b[31mname\u009b1mtail\u0000end";

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
    const tool = registerTemplateTool();

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
      ctx,
    );

    expect(result.content[0]?.type).toBe("text");
    const details = result.details as { config: string; data: string; cache: string };
    expect(details.config).toContain("vitest-app");
    expect(details.data).toContain("vitest-app");
    expect(details.cache).toContain("vitest-app");
  });

  it("sanitizes model arguments in renderCall", () => {
    const tool = registerTemplateTool();
    const hostile = { appName: "\u001b]0;evil\u0007app\u001b[31mname" };

    const text = renderedText(
      tool.renderCall?.(hostile, { expanded: false, isPartial: false }, theme),
    );

    expect(text).not.toMatch(CONTROL_BYTES);
    const status = JSON.parse(text) as { icon: string; description: string };
    expect(status.icon).toBe("done");
    expect(status.description).toContain("app");
  });

  it("survives a numeric argument that violates the declared schema type", () => {
    const tool = registerTemplateTool();

    const text = renderedText(
      tool.renderCall?.({ appName: 42 }, { expanded: false, isPartial: true }, theme),
    );

    const status = JSON.parse(text) as { icon: string; description: string };
    expect(status.icon).toBe("pending");
    expect(status.description).toBe("42");
  });

  it("sanitizes result data in renderResult and keeps the read badge", () => {
    const tool = registerTemplateTool();
    const result = {
      content: [{ type: "text" as const, text: "ok" }],
      details: {
        config: "/home/user/.config/\u001b]8;;https://evil\u0007app",
        data: "/home/user/.local/share/app",
        cache: "/home/user/.cache/\u009bapp",
      },
    };

    const text = renderedText(
      tool.renderResult?.(result, { expanded: false, isPartial: false }, theme),
    );

    expect(text).not.toMatch(CONTROL_BYTES);
    const status = JSON.parse(text) as {
      icon: string;
      badge: { label: string; color: string };
      meta: string[];
    };
    expect(status.icon).toBe("done");
    expect(status.badge).toEqual({ label: "read", color: "accent" });
    expect(status.meta.join(" ")).toContain("config");
  });

  it("marks an error result with the error icon and no meta", () => {
    const tool = registerTemplateTool();
    const result = { content: [{ type: "text" as const, text: "boom" }], isError: true };

    const text = renderedText(
      tool.renderResult?.(result, { expanded: false, isPartial: false }, theme),
    );

    const status = JSON.parse(text) as { icon: string; meta?: string[] };
    expect(status.icon).toBe("error");
    expect(status.meta).toBeUndefined();
  });
});
