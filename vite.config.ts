import oxfmt from "@agntn/ox/oxfmt";
import oxlint from "@agntn/ox/oxlint";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // changelogen writes two spaces after the ⚠️ of a breaking entry and oxfmt wants one. Anchored,
  // so a nested `CHANGELOG.md` is still formatted.
  fmt: { ...oxfmt, ignorePatterns: ["/CHANGELOG.md"] },
  lint: {
    ...oxlint,
    rules: {
      ...oxlint.rules,
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["typebox", "typebox/*"],
              message:
                "Take `Type` from `@agntn/tools`: OMP rewrites a bare `typebox` import to its facade, and `Value.Check` then accepts anything.",
            },
          ],
        },
      ],
    },
    ignorePatterns: [],
  },
});
