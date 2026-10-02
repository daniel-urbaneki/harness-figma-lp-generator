---
name: "Figma → LP guardrails"
description: "Thin pointer to the project's real rules (CLAUDE.md + .claude/rules/) — Figma as the source of truth, scope per projects/<slug>/, no invented assets."
applyTo: "**"
---

# Figma → LP — essential guardrails

This file is a pointer, not the source of truth. The complete documentation lives in:

- `CLAUDE.md` — objective, stack, structure, required workflow
- `.claude/rules/*.md` — detailed rule per domain (`core`, `figma`, `assets`, `html-css-js`,
  `responsive`, `validation`, `media`, `tooling`)
- `.claude/skills/*` — executable procedure per workflow step

Read those files before any substantial change. Do not duplicate their content here.

## Non-negotiables (summary — the complete rule is in the files above)

- Figma is the visual source of truth. Never invent an element, color, spacing or asset that is not
  in the design.
- The landing page goes in `projects/<slug>/` — never `output/<slug>/` (old convention).
- Do not replace an original Figma asset with an approximation (icon library, emoji, CSS, recreated
  SVG) when the original is available.
- `scripts/*.mjs` and `.claude/hooks/*.mjs` go through `npm run verify` (lint + typecheck + test +
  format:check) before the change is considered done — `rules/tooling.md`.
- Do not install a new dependency without explicit authorization.
- Do not modify another `projects/<slug>/` without an explicit request.
