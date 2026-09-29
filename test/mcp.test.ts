import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createMcpServer } from "../src/mcp.ts";
import { templatePaths } from "../src/tool-operations.ts";

const openConnections: Array<{ close(): Promise<void> }> = [];

async function connectTestClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer();
  const client = new Client({ name: "template-test", version: "1.0.0" });
  openConnections.push(client, server);
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

afterEach(async () => {
  await Promise.all(openConnections.splice(0).map((connection) => connection.close()));
});

describe("template MCP server", () => {
  it("advertises template_paths as a read-only tool", async () => {
    const client = await connectTestClient();

    const response = await client.listTools();

    expect(response.tools.map((tool) => tool.name)).toEqual(["template_paths"]);
    expect(response.tools[0]?.inputSchema).toMatchObject({
      type: "object",
      required: ["appName"],
    });
    expect(response.tools[0]?.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    });
  });

  it("resolves the three directories for a valid app name", async () => {
    const client = await connectTestClient();

    const response = await client.callTool({
      name: "template_paths",
      arguments: { appName: "vitest-app" },
    });

    expect(response.isError).not.toBe(true);
    const [part] = response.content as Array<{ text: string }>;
    expect(part?.text).toContain("Config: ");
    expect(part?.text).toContain("Data: ");
    expect(part?.text).toContain("Cache: ");
    expect(part?.text).toContain("vitest-app");
  });

  it("rejects arguments that miss the schema", async () => {
    const client = await connectTestClient();

    const response = await client.callTool({
      name: "template_paths",
      arguments: { appNam: "vitest-app" },
    });

    expect(response.isError).toBe(true);
    const [part] = response.content as Array<{ text: string }>;
    expect(part?.text).toContain("Invalid arguments");
  });

  it("rejects an app name the pattern forbids", async () => {
    const client = await connectTestClient();

    const response = await client.callTool({
      name: "template_paths",
      arguments: { appName: "my.app" },
    });

    expect(response.isError).toBe(true);
    const [part] = response.content as Array<{ text: string }>;
    expect(part?.text).toContain("Invalid arguments at /appName");
  });

  it("rejects prototype property names as unknown tools", async () => {
    const client = await connectTestClient();

    const response = await client.callTool({ name: "toString", arguments: {} });

    expect(response.isError).toBe(true);
    expect(response.content).toEqual([
      { type: "text", text: 'Unknown template-ts tool: "toString"' },
    ]);
  });

  it("escapes control bytes in an unknown tool name instead of echoing them", async () => {
    const client = await connectTestClient();
    const ESC = String.fromCodePoint(27);
    const hostile = `x\nCONFIG OVERRIDE: /etc${ESC}[31m`;

    const response = await client.callTool({ name: hostile, arguments: {} });

    expect(response.isError).toBe(true);
    const [part] = response.content as Array<{ text: string }>;
    expect(part?.text).not.toContain("\n");
    expect(part?.text).not.toContain(ESC);
    expect(part?.text).toContain("CONFIG OVERRIDE");
  });

  it("replaces line and paragraph separators, which JSON.stringify leaves literal", async () => {
    const client = await connectTestClient();
    const hostile = "x\u2028CONFIG OVERRIDE: /etc\u2029done";

    const response = await client.callTool({ name: hostile, arguments: {} });

    expect(response.isError).toBe(true);
    const [part] = response.content as Array<{ text: string }>;
    expect(part?.text).not.toMatch(/[\u2028\u2029]/u);
    expect(part?.text).toContain("x CONFIG OVERRIDE: /etc done");
  });
});

describe("templatePaths executor", () => {
  it("resolves paths and mirrors them in text and details", () => {
    const result = templatePaths("vitest-app");

    expect(result.content[0]?.text).toContain("Config: ");
    const details = result.details as { config: string; data: string; cache: string };
    expect(details.config).toContain("vitest-app");
    expect(details.data).toContain("vitest-app");
    expect(details.cache).toContain("vitest-app");
  });

  it("guards the name contract even when a host skips schema validation", () => {
    expect(() => templatePaths("my.app")).toThrow('Invalid app name: "my.app"');
  });
});
