import { tool, type Tool } from "ai";
import { z } from "zod";
import { version } from "./version.ts";
type HelloInput = {
  name?: string;
};

type HelloOutput = {
  message: string;
  version: string;
};

export const helloTool: Tool<HelloInput, HelloOutput> = tool({
  description: "Say hello and return the package version.",
  inputSchema: z.object({
    name: z.string().optional().describe("Name to greet"),
  }),
  execute: async ({ name }) => {
    return {
      message: `Hello, ${name || "world"}!`,
      version,
    };
  },
});
