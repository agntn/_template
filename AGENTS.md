# AGENTS.md

Keep AGENTS.md updated with project status.

## Status

- Node.js 26 development/release baseline with Node.js 24 support is complete and verified.
- Stable TypeScript 7 typechecking and declaration builds are complete and verified.
- Direct dependencies and pnpm are updated to their latest stable releases and verified.

## Stack

- **Runtime**: Node.js 26 for development and release; >= 24 supported
- **Language**: TypeScript (strict)
- **Build**: obuild (zero-config ESM builder)
- **Test**: vitest
- **Lint**: oxlint + oxfmt
- **Typecheck**: tsc (native TypeScript 7)
- **Release**: changelogen
- **Package manager**: pnpm

## Scripts

- `pnpm dev` - stub build for development
- `pnpm build` - production build
- `pnpm test` - run tests (watch)
- `pnpm test:run` - run tests (single run)
- `pnpm lint` - lint + format check
- `pnpm fmt` - auto-fix lint + format
- `pnpm typecheck` - type checking
- `pnpm release` - test, build, and release

## Structure

```
src/          - source code
test/         - tests
dist/         - build output (generated)
```

## Conventions

- ESM only (`"type": "module"`)
- Exports use `.d.mts` / `.mjs` extensions
- Strict TypeScript (all strict checks enabled)
- No `as any`, `@ts-ignore`, or `@ts-expect-error`

## Status

- Pull requests and issues use short, freeform descriptions focused on why a change is needed or what went wrong.
