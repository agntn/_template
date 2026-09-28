#!/usr/bin/env node

import { version } from "./version.ts";

/**
 * citty colors its usage and its errors even into a pipe, takes `NO_COLOR` only as `1`, and decides
 * once, as it loads, so `template-ts --help | less`, a file or an agent's transcript gets the escapes.
 * The terminal decides here, before citty loads: colors only when both streams citty writes to are
 * terminals that take them, and `hasColors()` already honors any `NO_COLOR` and `TERM=dumb`.
 */
const { stderr, stdout } = process;
if (!(stdout.isTTY && stdout.hasColors() && stderr.isTTY && stderr.hasColors())) {
  process.env["NO_COLOR"] = "1";
}
const { defineCommand, runMain } = await import("citty");

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
