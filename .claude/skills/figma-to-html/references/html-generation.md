# HTML Generation Rules

> Loaded by: `agents/frontend-builder.md` (build mode)
> Purpose: pipeline-specific mechanics to turn an `ExtractionOutput` (desktop +
> mobile) into a `BuildOutput`. The general HTML/CSS/JS policy (semantics, naming, entities,
> `loading="lazy"`, standard components such as carousel/FAQ/video) is in `rules/html-css-js.md`,
> `rules/media.md`, `rules/responsive.md`, `rules/figma.md` — read those first, they apply
> to any implementation, not only to this pipeline. This file covers only what is specific
> to the schema/agent.

## Inputs you receive

- `extraction` — the extractor's full `ExtractionOutput` JSON: `extraction.desktop` (always present) and `extraction.mobile` (`ViewportData` or `null`)
- `mode` — `"with-assets"` or `"skeleton"`
- `sectionSlug` — short unique prefix for the CSS scope (e.g. `s1`, `s2`)
- `carouselDecision` — only present when `extraction.carouselCandidate` is `true`: `"swiper"`
  or `"static"`, the user's answer already collected by the orchestrator (`rules/html-css-js.md` section
  7.1). You never decide this on your own from the layout.

## Root tag — `sN` section, or `<header>`/`<footer>`

`rules/page-structure.md` fixes the skeleton. Apply it at the fragment level:

- `extraction.isHeader: true` → root element is `<header>`, not `<section class="sN">` (the
  `sectionSlug` still scopes the CSS classes inside it, just not as the root's own class).
- Footer section → root element is `<footer>`.
- Every other section → root element is `<section class="{sectionSlug}">` (`sectionSlug`
  itself IS the `sN` class — do not add a separate descriptive root class instead of it).
- Inside the root element, the first structural child is the block's container (`.container`,
  or a variant class if this section's lateral margin differs from the shared one — never a
  duplicate margin declared elsewhere in the section) — `rules/page-structure.md` section 3,
  `rules/css-sizing.md` "Side margins". Skip it only when the section genuinely has no lateral
  margin (full-bleed edge-to-edge content).

## Output contract

Return a single JSON object matching the Zod schema `BuildOutput` in `scripts/schemas.mjs`:

```json
{
  "sectionId": "1:427",
  "html": "<section class=\"s1-hero\" data-figma-id=\"1:427\">...</section>",
  "css": ".s1-hero{...} @media (max-width:390px){.s1-hero{...}}",
  "js": "",
  "assetPlaceholders": ["s1-asset-0", "s1-asset-1"],
  "dataFigmaIds": ["1:427", "1:428", "1:430"],
  "warnings": []
}
```

- `js` is the section's behavior (if any), as plain JS text — WITHOUT a surrounding `<script>` tag. The orchestrator concatenates the `js` field of all sections into `projects/<slug>/js/main.js`. Never write an inline `<script>`/`<style>` inside the section's `html` — CSS/JS are always external files (`rules/html-css-js.md`). A section without behavior returns `js: ""`.
- `html` is only the section fragment (no `<html>`, `<head>`, `<body>`) — the same structure serves desktop and mobile, the difference lives entirely in the `css` (`rules/responsive.md`, `rules/html-css-js.md`).

## The structure comes from comparing both sides, not from the desktop alone

Before writing the HTML, read `extraction.layoutDeltas` (`rules/responsive.md` section 3) — it is the
node-by-node comparison the extractor already made between desktop and mobile. The HTML structure has to serve
both sides at once; do not build "the desktop" and treat mobile as a later adjustment.

| `kind`            | What to do in the HTML/CSS                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `direction-flip`  | the desktop `flex-direction` in the base block, inverted in the `@media` — never infer the mobile direction from the desktop                                                                                 |
| `grouping-needed` | **create the wrapper** (a single one, shared by both breakpoints) and neutralize it on the side that has the children flat: `gap` equal to the parent's when the values match, otherwise `display: contents` |
| `reorder`         | `order` on the children, or `column-reverse` — never reorder the HTML (the DOM order follows the desktop, which is the primary identity)                                                                     |
| `desktop-only`    | the element exists in the HTML once; `display: none` inside the `@media`                                                                                                                                     |
| `mobile-only`     | the element exists in the HTML once; `display: none` in the base block, visible in the `@media`                                                                                                              |
| `rotation`        | same element/asset, swapping dimension or `transform` in the `@media` (e.g. divider `2px × 71px` → `100% × 2px`)                                                                                             |
| `alignment`       | `justify-content`/`align-items` of its own per block                                                                                                                                                         |

A `grouping-needed` wrapper is not structure duplication (what `rules/responsive.md` section 4
forbids) — it is a single structure serving both sides, necessary because CSS does not reparent an element.
When the wrapper exists as a node in only one of the frames, `data-figma-id` carries only that
side's id, and a comment in the HTML marks that it is a synthetic wrapper on the other side.

If `layoutDeltas` comes back `[]` with a non-`null` `mobile`, the two sides have the same structure — only
values (spacing/size/typography) change between the blocks.

## Desktop base + mobile override — where each CSS block comes from

1. **Base block** (no media query): built from `extraction.desktop`. Assumes viewport 1920.
2. **`@media (max-width: 390px)` block**:
   - `extraction.mobile` is not `null` → use the REAL values from `extraction.mobile.tokens`/`layoutTree`/`figmaBbox`. That is why the extractor brings both sides — do not estimate when the data exists (`rules/figma.md`, `rules/core.md`).
   - `extraction.mobile` is `null` (the extractor already recorded this in `extraction.warnings`) → interpolating from the desktop by engineering judgment is acceptable as a fallback, but mark it with a comment in the CSS (`/* mobile interpolated from desktop — no corresponding Figma frame */`) so it stays traceable — see `rules/responsive.md` section 2.
3. Intermediate breakpoints (1515, 1366, 1025, 890, 550) have no Figma frame of their own — resolve them by fixed `px`/`%` values pinned per breakpoint via `@media`, computed between the two blocks above (never `clamp()`/`vw`/`vh`), per `rules/responsive.md` and `rules/css-sizing.md`.

## `data-figma-id` injection

Every element corresponding to a named Figma node MUST carry `data-figma-id="<nodeId>"`, using the id from the **desktop side** (the section's primary identity — `dataFigmaIds` does not duplicate the mobile id). The `visual-reviewer` uses that attribute for the layout IoU score.

## Asset that differs between desktop and mobile

If `extraction.desktop.assets[i]` and `extraction.mobile.assets[i]` (same visual slot) have a different `figmaUrl` — Figma shows a genuinely distinct image on mobile, not just the same one resized —, use `<picture>` with `<source media="(max-width: 390px)" srcset="...">` + an `<img>` desktop fallback (same element, without duplicating structure — `rules/html-css-js.md`). For `background-image`, the equivalent is a base rule with the desktop image and an override inside the `@media (max-width: 390px)` swapping only the `background-image`.

## Rules per mode

### `skeleton` mode (no real asset)

For every Asset of `extraction.desktop.assets` (and of `extraction.mobile.assets` when it diverges from the desktop for the same slot):

- Emit an `assetPlaceholders` entry with a unique id (e.g. `s1-asset-0`, or `s1-asset-0-mobile` when it is the mobile variant of a diverging slot).
- In the HTML:
  - `img` usage (informative): `<img data-asset-placeholder="s1-asset-0" alt="<real description generated from the Figma node name/rawDesignContext/section screenshot>" width="W" height="H" style="background:#ccc">` using the desktop side's `figmaBbox` dimensions for `width`/`height` (real dimension, `rules/media.md` section 1). Generate the `alt` already at this step — never leave it empty nor defer it to the `asset-reviewer` (it only swaps `src`, it does not decide alt).
  - `background` usage: `<div data-asset-placeholder="s1-asset-0" class="s1-bg-placeholder" style="background:#e5e5e5">` — without `alt` (it is not an `<img>`). Always a `<div>`/container with CSS `background-image`, never an `<img>` inside a `position: absolute` wrapper (`rules/media.md` section 6) — applies to every background layer, including a layered mobile composition (texture + masked photo + gradient).
  - `decorative` usage: skip entirely, or emit it with `alt=""` if it needs to exist as an `<img>` (`rules/html-css-js.md` section 6).

### `with-assets` mode

Same as skeleton BUT:

- It still emits `assetPlaceholders` with unique ids.
- The `asset-reviewer` runs next and replaces each `data-asset-placeholder` marker with a real `<img src>`/`<source srcset>` or `background-image: url()`.
- You do NOT write a real asset reference.

## Self-check before returning

1. All the HTML/CSS/JS follows `rules/html-css-js.md`, `rules/media.md`, `rules/responsive.md` (semantics, naming, UTF-8 entities, no `loading="lazy"`, standard carousel/FAQ/video components when applicable).
2. If `extraction.carouselCandidate` is `true`, the delivered HTML/CSS/JS matches the
   `carouselDecision` received (vendored Swiper if `"swiper"`, static list/grid without
   Swiper if `"static"`) — never the heuristic decided on your own.
3. Every `extraction.layoutDeltas` entry is reflected in the delivered HTML/CSS — in particular
   `grouping-needed` (does the wrapper exist?) and `direction-flip` (does the `@media` flip the axis?).
4. `html` has no embedded `<style>`/`<script>` tag.
5. Colors/spacing of the base block come from `extraction.desktop.tokens`; those of the `@media` come from `extraction.mobile.tokens` (or carry the fallback comment, if `mobile` is `null`).
6. CSS 100% scoped with `sectionSlug`, inside and outside `@media`.
7. Every element with a named Figma node has the desktop side's `data-figma-id`.
8. Semantics: no invented HTML tag (only standard HTML5); real headings (a single `h1` on the
   whole page, `h2`/`h3`+ without skipping a level — do not use a heading just because of the font's
   visual weight); item lists in `ul`/`li`; every informative `<img>` with a real descriptive `alt` and
   `width`/`height` at the asset's real dimension (`rules/html-css-js.md` sections 1/6,
   `rules/media.md` section 1).
9. Root tag matches `extraction.isHeader`/footer/regular-section per the table above, and the
   root element has a container child (`.container` or a variant) driving its lateral margin,
   unless the section is genuinely full-bleed (`rules/page-structure.md`).
10. **CSS hygiene (`rules/css-sizing.md`)**: no `min()`/`max()`/`clamp()`, no `vw`/`vh`, no
    `aspect-ratio`, no `margin: auto`, `calc()` only if truly necessary, no broken/decimal numbers
    (round unless Figma fidelity genuinely requires it), no `@media` override repeating a value
    already set at a wider breakpoint. This applies to every block you write — base and every
    `@media` — not only the 390px one.
