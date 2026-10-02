# Core

## Principles

- Figma is the visual source of truth.
- `CLAUDE.md` defines the project context and workflow.
- `.claude/rules/` defines domain-specific rules.
- When a decision is not defined, never invent: analyze the context or ask the user.

## Priority on conflict

1. Explicit user instruction in the current task
2. Figma (visual source of truth)
3. `CLAUDE.md`
4. `.claude/rules/*`

## Required behavior

- Do not start implementation before the Figma analysis (`rules/figma.md`).
- Follow the workflow defined in `CLAUDE.md`:
  **Analysis → Planning → Assets → HTML → CSS → JS → Responsiveness → Validation → Correction → Delivery.**
- Do not skip workflow steps for convenience.
- Do not assume design decisions that are not defined in Figma or in the user's instructions.
- Do not change files outside the scope of the requested landing page.

## Ambiguity

When Figma or the request does not clearly define a visual or functional behavior, never invent.

Examples:

- hover;
- transitions;
- animations;
- breakpoints;
- interaction states;
- component behavior;
- carousel (Swiper) candidate component — always ask before implementing,
  even when the pattern recurs across LPs (`rules/html-css-js.md` section 7.1);
- missing content.

Ask the user whenever the decision can change the final result of the LP.

## Scope

Each task must affect only:

`projects/<slug>/`

Do not modify another landing page, project or file outside the scope without explicit authorization.

Projects in `projects/<slug>/` must also not be referenced by files of the general
repository (`README.md`, `CLAUDE.md`, `docs/*.md`). Full rule (reason, slug naming,
indexing): `rules/project-naming.md` section 4.
