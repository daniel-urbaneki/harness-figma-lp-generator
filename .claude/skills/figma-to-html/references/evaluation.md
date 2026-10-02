# Evaluation Rules

> Loaded by: `agents/visual-reviewer.md`

## Your job

Compare a rendered HTML section (or the full page) against a Figma screenshot of the same thing — **twice per section: desktop and mobile**. Produce one `EvalOutput` JSON per pass, with a composite score, per-signal scores, and actionable issues (each issue marked with `breakpoint: "desktop"` or `"mobile"`).

## Why two passes with different dimensions

See `rules/responsive.md` section 2 for the reason (Figma only draws 1920/430, the fixed mobile dev breakpoint is 390). In practice, for this agent:

- **Desktop pass**: Figma 1920 vs render 1920 — identical dimension, direct comparison.
- **Mobile pass**: Figma 430 vs render 390 — DIFFERENT dimension. SSIM and color overlap require both images to have the same dimension, so the Figma screenshot has to be resized to 390 before comparing (see "Mobile normalization" below).

## Inputs you receive

- `htmlPath` — local path of the HTML file (the full already-aggregated document, or the section-only wrapper the orchestrator creates for pre-aggregation evaluation)
- `breakpoint` — `"desktop"` or `"mobile"`, defines the viewport and which Figma side to compare
- `figmaScreenshotPath` — local PNG of the Figma reference (1920 wide if `breakpoint="desktop"`, 430 wide if `breakpoint="mobile"` — still at Figma's native size, the normalization is yours)
- `expectedBoxes` — map `{ figmaNodeId → { x, y, w, h } }` from the corresponding side's `layoutTree` (`extraction.desktop.layoutTree` or `extraction.mobile.layoutTree`)

**Note about the per-section wrapper:** per-section evaluation runs before the aggregation — the final `css/style.css` and `js/main.js` do not exist yet at that point. The temporary wrapper the orchestrator assembles for this evaluation MAY inline the section's `css`/`js` (embedded `<style>`/`<script>`) just to render the screenshot — it is a throwaway artifact in `.audit/`, not the final delivery, so it does not contradict the external CSS/JS rule of `rules/html-css-js.md`. The global evaluation (step 5 of `SKILL.md`) runs against the real `projects/<slug>/index.html`, already with external `css/`/`js/`.

## Mobile normalization (only when `breakpoint === "mobile"`)

Before computing any signal:

1. Resize the Figma screenshot (430 wide) to 390: `node scripts/render-html-screenshot.mjs resize <figmaScreenshotPath> <tmpFigma390.png> 390`.
2. Scale every `expectedBoxes` by the same factor `k = 390/430 ≈ 0.9070` before computing the layout IoU: `{x: x*k, y: y*k, w: w*k, h: h*k}` for each bbox.
3. From here on, follow the normal procedure using `tmpFigma390.png` as the reference — the comparison is always 390×H against 390×H.

When `breakpoint === "desktop"`, skip that whole step — Figma 1920 and render 1920 already match.

## Procedure

1. Render the HTML to PNG with the right viewport: `node scripts/render-html-screenshot.mjs screenshot <htmlPath> <tmpPng>` — use `viewportWidth: 1920` if `breakpoint="desktop"`, `viewportWidth: 390` if `breakpoint="mobile"`, always `fullPage: false`.
2. Extract the real bounding boxes via `node scripts/render-html-screenshot.mjs boxes <htmlPath>` (same viewport as step 1).
3. If `breakpoint === "mobile"`, apply the normalization above before proceeding.
4. Compute SSIM: `node scripts/compute-ssim.mjs <reference (original or resized)> <tmpPng>`.
5. Compute the layout IoU: write `expectedBoxes` (already scaled if mobile) and `actualBoxes` to two temporary JSON files, then `node scripts/compute-layout-iou.mjs <exp.json> <act.json>`.
6. Compute the color overlap: `node scripts/compute-color-overlap.mjs <reference> <tmpPng>`.
7. Compute the composite: `node scripts/compute-composite-score.mjs '{"ssim":X,"layoutIoU":Y,"colorOverlap":Z}'`.
8. Assemble the issue list by comparing actual vs expected per element, each issue with `"breakpoint": "<desktop|mobile>"`:
   - If the bounding box delta is > 20px (on the already normalized scale) on any axis → `layout-offset` issue
   - If a `data-figma-id` from `expectedBoxes` is missing in `actualBoxes` → `missing-element`
   - If `actualBoxes` has an extra element that is not in `expectedBoxes` → `extra-element`
   - If the color overlap is below 0.8 → add a `color-mismatch` issue at the section level
9. Assemble `recommendations`: one readable sentence per issue, suggesting a likely fix.
10. Return this pass's `EvalOutput` JSON.

## Output contract

Matches exactly the Zod schema `EvalOutput` in `scripts/schemas.mjs` — one call of yours = one `EvalOutput` = one `breakpoint`. The orchestrator dispatches you 2x per section (desktop and mobile) and combines the two results (see `SKILL.md`, "Correction loop").

## Constraints

- YOU MUST use the Node scripts for every numeric computation — no manual math.
- DO NOT suggest a fix in the HTML/CSS — only describe the problem. The corrector decides how to fix it.
- YOU MUST attach every issue to a specific `data-figma-id` when possible.
- YOU MUST mark every issue with the correct `breakpoint` — the corrector uses that to know whether the fix goes in the base block or in the `@media (max-width: 390px)`.
