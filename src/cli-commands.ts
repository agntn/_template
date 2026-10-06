/** CLI-only `hello`: no model needs a greeting, so MCP and the extensions never see it. */

import { defineTool, Type } from "@agntn/tools";

export const helloCommand = defineTool({
  name: "template_hello",
  title: "Hello",
  description: "Say hello",
  effect: "read",
  input: Type.Object(
    { name: Type.Optional(Type.String({ description: "Name to greet" })) },
    { additionalProperties: false },
  ),
  cli: { command: "hello", positional: ["name"] },
  execute: ({ name }) => {
    const greeted = name || "world";
    return { content: [{ type: "text", text: `Hello, ${greeted}!` }], details: { name: greeted } };
  },
});
