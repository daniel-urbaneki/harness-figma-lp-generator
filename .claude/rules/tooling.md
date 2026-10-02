# Tooling Rule

## Objective

Ensure that the project's support code — `scripts/*.mjs` (scoring/render of the `figma-to-html`
pipeline) and `.claude/hooks/*.mjs` — goes through the same automatic verification that validates
any other Node code, before considering a change in those folders finished.

This rule is orthogonal to the Figma → LP workflow (`CLAUDE.md`, the other `rules/*.md`) — it does
not apply to `projects/<slug>/` (LP fidelity has its own rule in `rules/validation.md`).

---

## 1. When it applies

- Any change in `scripts/**/*.mjs`.
- Any change in `.claude/hooks/**/*.mjs`.
- Does not apply to `projects/<slug>/**` (generated HTML/CSS/JS is governed by
  `rules/html-css-js.md` and validated by `rules/validation.md`, not by this file).

---

## 2. Before considering the change finished

Run `npm run verify` (lint + typecheck + test + format:check) and confirm it passes without error.
If something fails:

- `lint`/`format:check` — fix with `npm run lint -- --fix` / `npm run format`, review the diff.
- `typecheck` — annotate the type via JSDoc on the parameter/return that was missing; use
  `@ts-expect-error` with a comment explaining the reason only when the mismatch comes from an
  external lib without a correct type (document the real cause, do not silence without explanation).
- `test` — coverage is still minimal (smoke test only); when adding new logic in `scripts/`, a
  real test (Vitest) is welcome, not required yet.

---

## 3. Vendored assets and reference artifacts never go through lint/format

`projects/**/assets/vendor/**` (Swiper, lite-youtube-embed — `rules/assets.md` section 7,
`rules/media.md` section 5, `rules/html-css-js.md` section 7.1) is excluded from `.prettierignore`
and from the `ignores` of `eslint.config.js`. Never remove that exclusion — reformatting/linting a
vendored third-party file contradicts `rules/assets.md` ("do not modify the original asset").

`.claude/rules/references/**` (canonical page skeleton, `rules/page-structure.md`) is excluded from
`.prettierignore` for the same reason: they are templates used to be reproduced in a new LP. Reformatting changes what the template generates — keep it byte-stable.

---

## 4. CI and pre-commit

- `.github/workflows/ci.yml` runs `npm run verify` on every push/PR — if `verify` fails locally,
  CI fails the same way.
- `.husky/pre-commit` runs `lint-staged` (eslint --fix + prettier --write on the staged files) —
  a commit can fail if `eslint --fix` cannot fix automatically (e.g. a type error or a
  non-auto-fixable rule).
