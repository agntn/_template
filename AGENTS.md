# AGENTS.md

Keep AGENTS.md updated with project status.

## Status

- Node.js 26 development/release baseline with Node.js 24 support is complete and verified.
- Stable TypeScript 7 typechecking and declaration builds are complete and verified.
- Direct dependencies and pnpm are updated to their latest stable releases and verified.
- npm publishing uses GitHub Actions OIDC trusted publishing without a long-lived registry token.
- A publishable Pi extension template with isolated typechecking is complete and verified.
- A publishable OMP extension template sharing the isolated typechecking setup is complete and verified.
- `pnpm typecheck` covers `test/` through `test/tsconfig.json`, after the build, since tests import the extensions and their `dist` types. Vitest only strips types, so nothing checked the tests before.
- The OMP extension draws its status line with the host `theme` and imports only the `@oh-my-pi/pi-coding-agent` root at runtime. Compiled OMP injects no `/tui`, so `renderStatusLine` from there stopped the extension loading; the unit test now throws on that import.
- An MCP server template sharing its tool executors with the Pi and OMP extensions is complete and verified.
- A tool executor throws when it cannot answer, and `ToolResult` has no `isError`: Pi records every returned value as a successful call, so a returned failure read as success there. The MCP handler turns the throw into a sanitized `isError` result.
- MCP error text and OMP renderer text replace `[\p{Cc}\p{Zl}\p{Zp}]` with spaces. U+2028 and U+2029 are not `Cc`, `JSON.stringify` leaves them literal, and most renderers still break a line on them.
- A local MCP server needs a restart, not `pnpm build`: inside a checkout `dist/cli.mjs` loads the `mcp` command from `src/` (see Conventions). `test/cli.test.ts` proves both modes and each guard.
- Extension tests go through `test/fixtures/`: Pi's own loader and runner for Pi, a strict OMP host double that throws by name on any member the test did not stub. The OMP package root ships TypeScript inside `node_modules`, so Node cannot load its real loader.
- The CLI keeps citty's colors out of pipes, files and terminals without color support.
- Linting and formatting consume the shared `@agntn/ox` policy.
- The toolchain runs on Vite+ 1.0: `vp pack` keeps obuild's `dist/` layout (`_chunks/<name>.mjs`, source and declaration maps), CI installs through `voidzero-dev/setup-vp`.

## Stack

- **Runtime**: Node.js 26 for development and release; >= 24 supported
- **Language**: TypeScript (strict)
- **Toolchain**: Vite+ (`vp`), one `vite.config.ts` for pack, test, lint and fmt
- **Build**: `vp pack` (tsdown)
- **Test**: `vp test` (bundled Vitest, API from `vite-plus/test`)
- **Lint**: `vp lint` + `vp fmt` (Oxlint + Oxfmt) through `@agntn/ox`
- **Typecheck**: tsc (native TypeScript 7)
- **Release**: changelogen
- **Package manager**: pnpm

## Scripts

- `pnpm dev` - stub build for development
- `pnpm build` - production build
- `pnpm test` - run tests once
- `pnpm test:watch` - run tests in watch mode
- `pnpm lint` - lint + format check
- `pnpm fmt` - auto-fix lint + format
- `pnpm typecheck` - type checking
- `pnpm release` - test, build, and release

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
