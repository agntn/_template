# AGENTS.md

Keep AGENTS.md updated with project status.

## Status

- Node.js 26 is the minimum and the only version CI tests and releases on.
- Stable TypeScript 7 typechecking and declaration builds are complete and verified.
- Direct dependencies and pnpm are updated to their latest stable releases and verified.
- npm publishing uses GitHub Actions OIDC trusted publishing without a long-lived registry token.
- A failed Publish run is recovered with `gh workflow run publish.yml --ref main -f tag=vX.Y.Z`, not a rerun: a rerun takes `publish.yml` from the tag's commit, so a workflow fix merged since never reaches it. The dispatch checks out `refs/tags/<tag>`, so a branch name typed as the tag fails the checkout instead of publishing `main` under the bumped version. `test/release.test.ts` pins that ref.
- A publishable Pi extension template with isolated typechecking is complete and verified.
- A publishable OMP extension template sharing the isolated typechecking setup is complete and verified.
- `pnpm typecheck` covers `test/` through `test/tsconfig.json`, after the build, since tests import the extensions and their `dist` types. Vitest only strips types, so nothing checked the tests before.
- The OMP extension imports nothing from `@oh-my-pi/pi-coding-agent` at runtime: `@agntn/tools/omp` draws the status line with the host `theme` and the `Text` the host hands over as `pi.pi.Text`. Compiled OMP injects no `/tui`, so `renderStatusLine` from there stopped the extension loading; the unit test still throws on that import.
- Each tool is declared once in `src/tools.ts` with `defineTool` from `@agntn/tools`, and the MCP server, both extensions and `src/ai.ts` take that list through its adapters. The executors in `src/tool-operations.ts` load on the first call, so the extensions register without loading the library. Schemas take `Type` from `@agntn/tools`, never from `typebox`: OMP rewrites a bare `typebox` import to its own facade, and `Value.Check` then accepts anything.
- The manifest has no `typebox`, zod or `@modelcontextprotocol/sdk` 1.x left. MCP runs on `@modelcontextprotocol/server` 2.x, and Pi 0.99 stopped warning about `typebox` in `dependencies`.
- A tool executor throws when it can't answer, and its `ToolResult` has no `isError`. The Pi adapter keeps its default `failures: "throw"`, since Pi up to 0.98 records every returned value as a successful call. The MCP adapter turns the throw into a sanitized `isError` result.
- MCP error text and OMP renderer text go through `sanitizeLine` from `@agntn/tools`, which replaces `[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]` with spaces. U+2028 and U+2029 are not `Cc`, `JSON.stringify` leaves them literal, and most renderers still break a line on them. `Cf` covers bidi overrides and isolates, zero-width characters and tag characters, which make a line read differently from its bytes; it handles a single line, so dropping ZWJ and ZWNJ costs nothing there.
- A local MCP server needs a restart, not `pnpm build`: inside a checkout `dist/cli.mjs` loads the `mcp` command from `src/` (see Conventions). `test/cli.test.ts` proves both modes and each guard. Its load hook writes the module list to a file: stderr written in an exit handler stops at about 146 KB in a pipe, so a long checkout path cut the JSON.
- A server running `src/` refuses every tool call once anything under `src/` changed since it started, with `src/ changed under this server, restart it to load the new code`. Its ESM cache keeps the modules it already loaded, so after a pull a lazy import met an old export and failed with `does not provide an export named` on a tool the pull never touched (keys, 2026-10-02). `src/source-change.ts` compares the newest ctime under `src/` before each call, about 5 ms over the 614 files of puzzles; ctime catches a copy that kept an old mtime, and a parent's ctime catches a removed file. The bundle can't mix versions and stays unguarded. A sibling whose `src/` imports a tree beside it (hashes: `packages/shared/`) guards that tree too.
- Extension tests go through `test/fixtures/`: Pi's own loader and runner for Pi, a strict OMP host double that throws by name on any member the test did not stub. The OMP package root ships TypeScript inside `node_modules`, so Node cannot load its real loader.
- `pnpm release` and the Publish workflow build before `pnpm test`, as CI does. The `mcp` checks in `test/cli.test.ts` start `dist/cli.mjs`, so testing first ran them against a stale build, or skipped them on a clean runner. `test/release.test.ts` fails when either order flips.
- The CLI keeps citty's colors out of pipes, files and terminals without color support.
- `src/cli.ts` reads the arguments before citty does and stops at the first dashed one that names no option of the command, with one line that points at `--`. citty takes `-_8` for the flags `_` and `8`, and a flag named `_` overwrites its positionals and crashes it with a `TypeError`; a typo like `--nmae` it just drops. `src/cli-args.ts` walks a short group the way `util.parseArgs` does, so `-vkx` still passes, spells names through `scule` like citty's bundled copy (`page_size` takes `--page-size`), and leaves citty only the tokens its `runMain` answers before parsing: an exact `--help` or `-h` anywhere, a lone `--version` or `-v`. Siblings copy the guard from there.
- Linting and formatting consume the shared `@agntn/ox` policy.
- `vp fmt` skips the root `CHANGELOG.md`. changelogen writes two spaces after the ⚠️ of a breaking entry and oxfmt wants one, so the check failed after every breaking release. The pattern is anchored, so a nested `CHANGELOG.md` is still formatted.
- `pnpm-workspace.yaml` exempts `@agntn/*` from `minimumReleaseAge`. A clean frozen install rejects a lockfile entry younger than a day, so CI failed for a day after every sibling release. The scope pattern also covers the next package and version, which an exact entry does not.
- The toolchain runs on Vite+ 1.0 for lint, fmt and test, and CI installs through `voidzero-dev/setup-vp`. The build went back to obuild, like `@agntn/puzzles`, `@agntn/keys` and `@agntn/hashes`: the same `dist/` files and exports as `vp pack`, with less JS.

## Stack

- **Runtime**: Node.js >= 26
- **Language**: TypeScript (strict)
- **Toolchain**: Vite+ (`vp`), one `vite.config.ts` for test, lint and fmt
- **Build**: obuild from `build.config.ts`, one bundle for all five entries, chunks under `dist/_chunks/` with stable names
- **Test**: `vp test` (bundled Vitest, API from `vite-plus/test`)
- **Lint**: `vp lint` + `vp fmt` (Oxlint + Oxfmt) through `@agntn/ox`
- **Typecheck**: tsc (native TypeScript 7)
- **Release**: changelogen
- **Package manager**: pnpm

## Scripts

- `pnpm dev` - `obuild --stub`, so `dist` re-exports `src`. The three `mcp` bundle checks in `test/cli.test.ts` fail against it; run them after a real build
- `pnpm build` - production build
- `pnpm test` - run tests once
- `pnpm test:watch` - run tests in watch mode
- `pnpm lint` - lint + format check
- `pnpm fmt` - auto-fix lint + format
- `pnpm typecheck` - type checking
- `pnpm release` - build, test against that build, and release, in CI's order

## Structure

```
src/                     - source code
test/                    - tests
test/fixtures/           - typed Pi and OMP extension test hosts
packages/omp/extensions/ - OMP extension sources shipped with the package
packages/pi/extensions/  - Pi extension sources shipped with the package
dist/                    - build output (generated)
```

## Conventions

- ESM only (`"type": "module"`)
- Exports use `.d.mts` / `.mjs` extensions
- Strict TypeScript (all strict checks enabled)
- No `as any`, `@ts-ignore`, or `@ts-expect-error`
- Local MCP from source: `src/cli.ts` imports the `mcp` command from a runtime URL of `src/commands/mcp.ts` when the bin is built, `TEMPLATE_TS_DIST` is not `1`, the path has no `node_modules` segment (Node refuses to strip types there) and the file exists (the npm package ships only `dist`). Otherwise it takes the bundled command. Every runtime import on that path is a `dependency`, so no devDependency guard. Only an edit to `src/cli.ts` itself still needs a build. Relative imports end in `.ts` and `erasableSyntaxOnly` holds, or plain Node cannot run `src/`.

## Status

- Pull requests and issues use short, freeform descriptions focused on why a change is needed or what went wrong.
