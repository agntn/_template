import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { Type, type TSchema } from "typebox";
import { Value } from "typebox/value";
import {
  APP_NAME_MAX_LENGTH,
  APP_NAME_PATTERN,
  templatePaths,
  type ToolResult,
} from "./tool-operations.ts";
import { version } from "./version.ts";

interface ToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: TSchema;
  execute(args: Readonly<Record<string, unknown>>): ToolResult<unknown>;
}

const tools: readonly ToolDefinition[] = [
  {
    name: "template_paths",
    title: "Template Paths",
    description:
      "Resolve platform-standard config, data, and cache directories for an application, honoring platform conventions, XDG variables, and app-specific overrides.",
    inputSchema: Type.Object({
      appName: Type.String({
        description: "Filesystem-safe application name",
        minLength: 1,
        maxLength: APP_NAME_MAX_LENGTH,
        pattern: APP_NAME_PATTERN,
      }),
    }),
    execute: (args) => templatePaths(args.appName as string),
  },
];

/**
 * Formats the first TypeBox validation failure for an MCP client.
 *
 * @param schema - Schema used to validate the value.
 * @param value - Value that failed validation.
 * @returns {string} Human-readable validation failure.
 */
function validationError(schema: TSchema, value: unknown): string {
  const first = Value.Errors(schema, value)[0];
  if (!first) return "Invalid arguments";
  return `Invalid arguments at ${first.instancePath || "/"}: ${first.message}`;
}

/**
 * Wraps error text for the MCP client, replacing control bytes with spaces.
 *
 * Every error branch goes through here because parts of these messages echo
 * client-controlled values (a tool name, an argument) or downstream error
 * messages: one raw newline or escape byte would forge extra lines that read
 * as the server's own answer.
 *
 * @param text - Error text to sanitize and return.
 * @returns {CallToolResult} MCP error result.
 */
function errorResult(text: string): CallToolResult {
  return {
    content: [{ type: "text", text: text.replaceAll(/\p{Cc}/gu, " ") }],
    isError: true,
  };
}

/**
 * Creates an unconnected MCP server exposing the template tools.
 *
 * Built on the low-level `Server` even though the SDK marks it `@deprecated`,
 * because `McpServer.registerTool` accepts Standard Schema (Zod) only. TypeBox 1.x
 * does not implement Standard Schema, and this package's tool schemas are TypeBox,
 * shared with the Pi and OMP extensions. The high-level API would force a second
 * definition of every parameter.
 *
 * @returns {Server} Unconnected MCP server.
 */
export function createMcpServer(): Server {
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));
  const server = new Server({ name: "template-ts", version }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: tools.map((tool): Tool => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema as Tool["inputSchema"],
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, (request) => {
    const tool = toolsByName.get(request.params.name);
    if (!tool) {
      return errorResult(`Unknown template-ts tool: ${JSON.stringify(request.params.name)}`);
    }

    const args = request.params.arguments ?? {};
    if (!Value.Check(tool.inputSchema, args)) {
      return errorResult(validationError(tool.inputSchema, args));
    }

    try {
      // `details` stays out and `structuredContent` is never set: clients that see
      // structured output prefer it over `content` and would hide the readable answer.
      return { content: tool.execute(args).content };
    } catch (error) {
      return errorResult(
        `${tool.name} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  });

  return server;
}
