# Figma → Static Landing Pages

## Objective

Turn Figma designs into static landing pages using HTML, CSS and vanilla JavaScript.

Figma is the visual source of truth. The implementation must reproduce the design with high fidelity, without inventing or removing elements.

## Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Figma MCP
- Node.js for tooling

Do not use frameworks or external libraries without explicit authorization.

## Structure

Each landing page is independent and must live in:

`projects/<slug>/`

Standard structure:

```text
projects/<slug>/
├── index.html
├── css/
├── js/
└── assets/
```

Temporary files, metrics and audit data must stay out of the final output or in directories ignored by Git.

### Project name (slug) and indexing

Before creating a new project, always ask for the production URL of the page (used
in another project) — the folder name is exactly that URL. Every slug ends in
`-cpc` (paid traffic), `-org` (organic) or `-obrigada` (thank-you page); a `-cpc` or
`-obrigada` page requires `noindex` in the HTML, an `-org` page must not have `noindex`.
Projects in `projects/<slug>/` are never
referenced by the general repository (they are ephemeral, they will be deleted in the future).
See `.claude/rules/project-naming.md` for the complete procedure.

## Required workflow

Every implementation follows:

```text
Figma
→ Analysis
→ Planning
→ Assets
→ HTML
→ CSS
→ JavaScript
→ Responsiveness
→ Validation
→ Correction
→ Delivery
```

Do not start the implementation before understanding the visual structure of the Figma.

## Figma

Always ask the user for the **two selection links** — desktop (1920) and mobile (430), each with a
`node-id` — before any analysis or extraction. Never infer the mobile frame on your own.

Reading Figma always uses the **local MCP** (Dev Mode server of the desktop app,
`http://127.0.0.1:3845/mcp`), never the remote one. Ask the user whether it is active together with
the request for the links, in the same message — the server goes down when the app closes, so do not
assume it is still active since the last task. If it is inactive, guide the user to enable it and stop until it is resolved.
See `.claude/rules/figma.md` and the "Local Figma MCP" section of the `README.md`.

Before implementing a section:

1. identify the hierarchy;
2. identify components and elements;
3. identify typography, colors and spacing;
4. identify assets;
5. identify responsive behavior;
6. define the corresponding HTML structure.

See `.claude/rules/figma.md` for detailed rules.

## Assets

Always prioritize the original Figma assets.

SVGs must be exported as complete elements whenever possible. Do not fragment SVGs into parts to reconstruct them later in the HTML.

See `.claude/rules/assets.md` for the asset flow.

## HTML / CSS / JS

HTML must be semantic and organized.

CSS must prioritize:

- reusable classes;
- CSS variables;
- responsiveness;
- absence of unnecessary inline styles.

JavaScript must exist only when there is necessary behavior.

See `.claude/rules/html-css-js.md`.

## Responsiveness

The implementation must consider desktop, tablet and mobile.

Do not assume mobile is just a reduced version of desktop. Elements can change position, size, alignment or structure.

Compare the two frames (desktop and mobile) node by node **before** writing the HTML — axis inversion (row ↔ column) and grouping that exists on only one of the sides define the structure, and are not fixable later with CSS alone.

See `.claude/rules/responsive.md`.

## Validation

A landing page is not finished just because the code works.

Before finishing:

- validate structure;
- validate responsiveness;
- validate assets;
- validate spacing;
- validate typography;
- validate alignment;
- compare visually against the Figma;
- fix relevant differences.

See `.claude/rules/validation.md`.

## Critical rules

- Never invent elements.
- Do not remove elements without justification.
- Do not replace original assets with approximations when the original is available.
- Do not install dependencies without authorization.
- Do not change the visual identity of the Figma.
- Do not modify other landing pages without an explicit request.
- Do not consider the task done without validation.

## Commands

Use the commands available in `.claude/commands/` to run standardized workflows.

Main ones:

- `/analyze-figma`
- `/extract-assets`
- `/build-lp`
- `/validate-lp`
- `/fix-lp`
- `/full-build`

## Tooling

`scripts/*.mjs` (scoring/render of the `figma-to-html` pipeline) and `.claude/hooks/*.mjs` have
their own lint/typecheck/test/format (ESLint, TypeScript `checkJs`, Vitest, Prettier — run via
`npm run verify`), with CI and pre-commit (Husky) enforcing it. This rule does not apply to
`projects/<slug>/` — LP fidelity is still governed only by `rules/validation.md`.

See `.claude/rules/tooling.md`.

## Additional context

Do not duplicate detailed procedures in this file.

For specific rules, see:

- `.claude/rules/`
- `.claude/skills/`
- `.claude/commands/`
- `.claude/agents/`

Load only the knowledge necessary for the current task.
