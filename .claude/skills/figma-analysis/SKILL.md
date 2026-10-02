---
name: figma-analysis
description: Analyzes a Figma section or frame before any implementation — hierarchy, components, typography, colors, spacing, assets to export, responsive behavior (desktop 1920 + mobile 430). Manual use, directly on the main thread, with no JSON schema and no subagent — meant for 1 section/page at a time. Invoked by /analyze-figma.
---

# Figma Analysis

Lightweight skill — runs directly in the main conversation, calling `mcp__figma__*` yourself. Does not dispatch a subagent, does not produce schema JSON (that belongs to the `figma-to-html` pipeline, for when the user wants the full multi-agent run).

**Read `rules/figma.md` and `rules/core.md` first.** They define what to analyze and the rule of "never estimate when Figma has the real value".

## When to use

- Before implementing any new section (`rules/core.md`: "never start implementation before the Figma analysis").
- When the user asks for `/analyze-figma` or "analyze this Figma section/page".

## Inputs

- **Two Figma links, provided by the user** (`rules/figma.md`, "Selection links"):
  desktop (file + `node-id` of the section/frame at 1920) **and** mobile (file + `node-id` of the
  corresponding section/frame at 430). Ask for both at once before starting, if the user did not
  provide both — never infer the mobile one on your own.
- Project `slug` (folder `projects/<slug>/`) — if it is a new project (folder does not
  exist yet), **always ask** the user what the production URL of the page is
  (used in another project/site); the slug is exactly that URL, ending in `-cpc`
  or `-org` (`rules/project-naming.md`). Never derive it from the Figma file name or
  from the section.
- If the user only provides the file without a nodeId, ask which section/frame to analyze — never guess.

## Procedure

1. `mcp__figma__get_metadata` on the two given nodes (desktop and mobile) — map the hierarchy of each side (frame → group → component → element).
2. The mobile node comes from the link the user provided — do not go looking for it yourself.
   Fallback (only if the user said they do not have the mobile link, or asked you to infer it): look for a
   frame ~430px wide on the same page, sibling of the desktop frame (1920px) — `rules/responsive.md`
   section 2 — and **confirm with the user which node was chosen** before continuing. If no
   candidate is found, record it as a pending item and ask how to proceed; never continue with desktop
   only, silently, nor invent the mobile side (`rules/figma.md`, "Selection links").
3. `mcp__figma__get_design_context` on the desktop node (and on the mobile one, when there is one) — extract:
   - typography (family, weight, size, line-height, letter-spacing);
   - colors (exact hex);
   - spacing (relevant padding, gap, margin);
   - components/instances and variants used.
4. `mcp__figma__get_screenshot` of both nodes (desktop and mobile, when there is one) — save via `Write` to `projects/<slug>/.audit/screenshots/<nodeId>-desktop.png` (and `-mobile.png`). It has to exist on disk for `visual-validation` to compare later — it is not just a visual reference for the answer.
5. **Compare desktop × mobile node by node** (`rules/responsive.md` section 3) — this is what defines the
   HTML structure, so it has to come out of this analysis, not out of the moment you write the `@media`. Check
   in each corresponding container:
   - **axis inversion** (`layoutMode` `HORIZONTAL` ↔ `VERTICAL`) — the most common case;
   - **grouping**: one side groups children into a sub-frame that the other has flat (child count/depth
     diverges) → **requires a wrapper in the HTML**, CSS does not reparent elements (section 3.2);
   - child order, node present on one side only, rotation of the same vector, alignment, spacing.

   List each difference found in the "Desktop × mobile differences" field of the output, with what it
   requires from the HTML/CSS. If the section has no mobile frame, there is no comparison — record that the
   mobile side will be interpolated (section 2).

6. Identify nodes that need to be exported as assets (icon, logo, image, illustration) — do not download here, just list them (`asset-management` handles the download).
7. Identify whether this section is the page's top nav/header bar (logo + menu + CTA, first
   block of the frame, often fixed/sticky) — `rules/page-structure.md`. If it is, note it in
   the output: it becomes `<header>` (not a numbered `sN` section). The page never uses
   `<main>` either way (with or without a header block).
8. Identify whether the section is a carousel candidate (`rules/html-css-js.md` section 7.1 — horizontal
   row of cards, coverflow, name "carousel"/"slider"/"galeria", more items than fit on
   screen). If it is, list it under "Ambiguities found" — never decide alone, and never assume it is a
   carousel just because a similar pattern already showed up in another LP.
9. Assemble the summary and present it to the user as structured text (see format below). Do not write a file unless the user asks you to store it.

## Output format (answer in the conversation)

```markdown
## Analysis — <section name>

**Hierarchy:** <tree summary>
**Components/variants:** <list>
**Typography:** <family, weights, sizes used>
**Colors:** <hex list>
**Spacing:** <recurring values>
**Assets to export:** <list of nodes, type, likely category>
**Header block:** <"yes — becomes `<header>`" or "no — regular `sN` section"> (page never uses `<main>` either way)
**Mobile:** <node from the link the user provided; if it came from the inference fallback, say so and which node was chosen (pending confirmation); or "no mobile frame — will need interpolation", if the user authorized continuing that way>

**Desktop × mobile differences:** <one line per structural difference found in the node-by-node comparison (rules/responsive.md section 3), with what it requires from the HTML/CSS. E.g.: "contact block: column on desktop → row on mobile (axis inversion, @media inverts flex-direction)"; "logo lockup: flat on desktop, grouped into a sub-frame on mobile → needs a shared wrapper, display:contents on desktop". If there is no structural difference, say "same structure on both sides, only values change">

**Elements that need grouping:** <list of the wrappers the HTML will need because of divergent grouping, with which children each one wraps and on which side the node exists in Figma. "None" if there are none>

**Ambiguities found:** <anything rules/core.md requires asking about before assuming — hover, transition, intermediate breakpoint, missing content, carousel candidate (Swiper) — ask explicitly whether to implement it as a Swiper or as a static list/grid>
```

## Rules

- Never estimate color/spacing/typography/dimension when the value can be obtained from Figma (`rules/figma.md`).
- If a needed node is not accessible via MCP, report the problem and ask how to proceed — do not estimate visually.
- Do not move on to implementation without this analysis having been done and (if there is any ambiguity) confirmed by the user.
