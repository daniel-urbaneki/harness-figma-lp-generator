# Correction Patterns

> Loaded by: `agents/frontend-builder.md` (correction mode)

## Your job

Given a combined report (issues from the desktop `EvalOutput` + the mobile `EvalOutput`, each issue already marked with its `breakpoint`) + the current HTML/CSS/JS + the original extraction, produce a corrected version that resolves the reported issues.

**Where to apply the fix:** an issue with `breakpoint: "desktop"` → fix it in the base CSS block (no media query). An issue with `breakpoint: "mobile"` → fix it inside the `@media (max-width: 390px)`. Never mix them — a mobile fix must not leak into the base block and affect the desktop, and vice versa.

## Issue → fix recipes

### `layout-offset`

- If the delta is vertical and the element is in a flex container, check the parent's `margin-top`, `padding-top`, `gap`, and `align-items`.
- If the delta is horizontal, check the parent's `margin-left` and `justify-content`.
- If the delta is > 50px, the element is probably in the wrong container. Move it in the DOM.

### `color-mismatch`

- Check whether the element uses a token from `extraction.tokens.colors` or a literal hex.
- If literal, replace it with the closest token.
- If a token, verify the token itself — the extractor may have labeled it wrong.

### `missing-element`

- The builder left out an element that the extraction referenced. Read `extraction.rawDesignContext` for the missing node and add it back.

### `extra-element`

- The builder added noise. Remove the element with that `data-figma-id` (or generated id).

### `text-mismatch`

- Copy the exact text from `extraction.rawDesignContext` character by character.

### `size-mismatch`

- If it is a width/height delta on an `<img>`, check whether the `asset-reviewer` used the right dimensions.
- If it is a delta on a container, check explicit `width`/`height` vs `max-width`.

## Output contract

Return a `CorrectionOutput` JSON (matching the Zod schema in `scripts/schemas.mjs`):

```json
{
  "sectionId": "1:427",
  "htmlPatched": "...",
  "cssPatched": "...",
  "jsPatched": "",
  "changelog": [
    {
      "change": "Moved .s1-cta from .s1-hero-body to .s1-hero-footer",
      "reason": "layout-offset reported 72px below expected"
    },
    {
      "change": "Swapped #7C3AED for #6D28D9 in .s1-card-3",
      "reason": "color-mismatch, deltaE 8.2"
    }
  ]
}
```

`jsPatched` follows the same rule as `js` in `BuildOutput`: plain text, no `<script>` tag, `""` if the section has no behavior or the behavior did not change.

## Rules

- YOU MAY add or remove an element. YOU MUST preserve `data-figma-id` attributes.
- YOU MUST cite the issue for every change in the changelog.
- DO NOT call Figma MCP.
- DO NOT re-run the evaluator — that is the orchestrator's job.
- If multiple changes group into a single fix, describe it as one changelog entry with a combined reason.
- If an issue has no applicable recipe, list it in the changelog with `change: "no-op"` and `reason: "no known fix"` — the orchestrator uses that as a signal to stop the loop.
