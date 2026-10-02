# Figma Extraction Rules

> Loaded by: `agents/figma-analyzer.md`
> Purpose: pipeline-specific mechanics to turn a Figma section (desktop +
> mobile) into an `ExtractionOutput` JSON. The general Figma asset/SVG extraction policy
> (export from the highest-level container, multi-fragment icon detection, export
> gotchas) is in `rules/assets.md` section 4 — read that first. This file covers only what
> is specific to the schema/agent.

## Inputs you receive

- `fileKey` — Figma file identifier
- `desktopSectionNodeId` — node id of the section in the desktop frame, format `X:Y`
- `mobileSectionNodeId` — node id of the corresponding section in the mobile frame, or `null` if the orchestrator found no reliable match
- `sectionName` — readable name for log/audit

## Tools you may use

- `mcp__figma__get_metadata` — for the hierarchy map
- `mcp__figma__get_design_context` — for the React+Tailwind snippet + asset URLs + tokens
- `mcp__figma__get_screenshot` — for the section's reference image

## Tools you MUST NOT use

- Any Figma MCP write tool — you only read, never write back
- `Write` or `Edit` on HTML — the builder owns the HTML; you only produce JSON

## Extraction procedure

1. Call `get_design_context` and `get_screenshot` for the `desktopSectionNodeId` in a single batch (parallel calls in one message). If `mobileSectionNodeId` is not `null`, call the same two for the mobile node in the SAME message (up to 4 parallel calls in total).
2. For each side (desktop, and mobile if it exists), parse the React+Tailwind snippet to extract colors (hex), font families/weights, spacing tokens.
3. For every `const imgXxx = "..."` in each side's snippet, add an `Asset` entry to that side's `assets` list — `type`/`usage`/`category` per `rules/assets.md` section 7. When you detect multiple sibling `imgVector*` URLs under the same parent (multi-fragment icon pattern, `rules/assets.md` section 4), record the common parent's `data-node-id` in `parentNodeId` — that is the only thing you do with that detection; the export rule itself (consolidating into a single SVG) belongs to the `asset-reviewer`.
4. Save the screenshots via `Write` (binary PNG): `projects/<outputSlug>/.audit/screenshots/<desktopSectionNodeId>-desktop.png` and `projects/<outputSlug>/.audit/screenshots/<mobileSectionNodeId>-mobile.png` (when applicable).
5. Build a normalized `layoutTree` for each side: a tree of `{ type, id, name, bbox, children }`. DO NOT copy the raw Figma JSON.
6. Extract `figmaBbox` (the section's own bbox) from the snippet's root node, for each side.
7. **If `mobileSectionNodeId` is `null`**: set `mobile: null`, and add to `warnings`: `"section with no mobile counterpart in Figma — the build will interpolate from desktop"`. DO NOT invent mobile tokens/layout to fill it in (`rules/core.md`, `rules/figma.md`).
8. **Detect a carousel candidate** (`rules/html-css-js.md` section 7.1): a horizontal row of
   repeated cards/images, staggered opacity/scale (coverflow), node name containing
   "carousel"/"slider"/"galeria", or more items than fit on one screen. If it matches, set
   `carouselCandidate: true` and add to `warnings`: `"carousel candidate section — confirm
with the user before implementing Swiper"`. **You only detect and flag — you never decide.** The
   one who asks the user and decides is the orchestrator, before dispatching the `frontend-builder`.
9. **Compare the two sides node by node and fill in `layoutDeltas`** (`rules/responsive.md` section 3) —
   only when `mobile` is not `null`. Walk the corresponding containers in both
   `layoutTree`/`rawDesignContext` and emit one entry per structural difference:
   - `direction-flip` — `layoutMode` inverts (`HORIZONTAL` ↔ `VERTICAL`);
   - `grouping-needed` — one side groups children in a sub-frame that the other has flat (child
     count or depth diverges). **This is the case that requires a wrapper in the HTML** — without that
     entry, the builder produces a structure that cannot be adjusted later with CSS alone;
   - `reorder`, `desktop-only`, `mobile-only`, `rotation`, `alignment` — per the schema enum.

   Fill in `implication` stating what the difference requires from the HTML/CSS (e.g. `"grouping
wrapper for the 3 children; display:contents on desktop, flex with gap 24px on mobile"`). That is the
   field the builder follows — it does not re-compare the sides.

10. **If the section is a top nav/header bar** (logo + menu + CTA, first block of the frame,
    often fixed/sticky) — `rules/page-structure.md`: set `isHeader: true`. This only affects
    which tag the builder emits (`<header>` instead of `section.sN`) — it never causes a
    `<main>` wrapper at aggregation, the page never uses `<main>` — you only detect, you never
    decide or ask.

## Output contract

Return a single JSON object matching the Zod schema `ExtractionOutput` in `scripts/schemas.mjs`.

Format (example, with mobile present):

```json
{
  "sectionId": "1:427",
  "sectionName": "hero",
  "desktop": {
    "nodeId": "1:427",
    "tokens": {
      "colors": { "primary": "#6D28D9" },
      "fonts": [{ "family": "Inter", "weights": [400, 700] }],
      "spacing": [8, 16, 24, 32]
    },
    "assets": [
      { "figmaUrl": "https://www.figma.com/api/mcp/asset/abc", "type": "svg", "usage": "img" }
    ],
    "layoutTree": {
      "type": "frame",
      "id": "1:427",
      "name": "Hero",
      "bbox": { "x": 0, "y": 0, "w": 1920, "h": 720 },
      "children": []
    },
    "rawDesignContext": "<desktop React/Tailwind snippet>",
    "screenshotPath": "projects/minha-landing/.audit/screenshots/1-427-desktop.png",
    "figmaBbox": { "x": 0, "y": 0, "w": 1920, "h": 720 }
  },
  "mobile": {
    "nodeId": "9:120",
    "tokens": {
      "colors": { "primary": "#6D28D9" },
      "fonts": [{ "family": "Inter", "weights": [400, 700] }],
      "spacing": [8, 16, 24]
    },
    "assets": [
      { "figmaUrl": "https://www.figma.com/api/mcp/asset/abc", "type": "svg", "usage": "img" }
    ],
    "layoutTree": {
      "type": "frame",
      "id": "9:120",
      "name": "Hero",
      "bbox": { "x": 0, "y": 0, "w": 430, "h": 540 },
      "children": []
    },
    "rawDesignContext": "<mobile React/Tailwind snippet>",
    "screenshotPath": "projects/minha-landing/.audit/screenshots/9-120-mobile.png",
    "figmaBbox": { "x": 0, "y": 0, "w": 430, "h": 540 }
  },
  "carouselCandidate": false,
  "isHeader": false,
  "layoutDeltas": [
    {
      "element": "Frame 4 (contato)",
      "kind": "direction-flip",
      "desktop": "VERTICAL — phone above the privacy link",
      "mobile": "HORIZONTAL — phone and privacy side by side",
      "implication": "base flex-direction:column; @media 390 flips to row"
    },
    {
      "element": "lockup de logos",
      "kind": "grouping-needed",
      "desktop": "3 flat children in the parent container row, itemSpacing 37",
      "mobile": "3 children in their own sub-frame (111:1184), itemSpacing 28.25",
      "implication": "shared wrapper in the HTML; gap 37 on desktop (matches the parent's), flex with gap 24 in the @media; data-figma-id only from the mobile side"
    }
  ],
  "warnings": []
}
```

`layoutDeltas` is `[]` when the two sides have the same structure, or when `mobile` is `null`.

When there is no mobile counterpart: `"mobile": null` and `"warnings": ["section with no mobile counterpart in Figma — the build will interpolate from desktop"]`.

## Rules

- **Never produce HTML.** That is the builder's job.
- **Never download an asset.** That is the `asset-reviewer`'s job.
- **Preserve `rawDesignContext` verbatim** (for each side). The corrector may need it later.
- **Never invent the mobile side.** If `mobileSectionNodeId` is `null`, the output's `mobile` is `null` — period.
- **Validate the output strictly** against the schema before returning. A field that cannot be filled in honestly becomes `null`/`[]` + an entry in `warnings`.
