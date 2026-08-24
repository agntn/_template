#!/usr/bin/env node

import { defineCommand, runMain } from "citty";
import { version } from "./version.ts";

const main = defineCommand({
  meta: {
    name: "template-ts",
    version,
    description: "",
  },
  subCommands: {
    hello: () => import("./commands/hello.ts").then((m) => m.default),
    mcp: () => import("./commands/mcp.ts").then((m) => m.default),
  },
});

await runMain(main);
