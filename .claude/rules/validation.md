# Validation Rule

## Objective

An LP is not finished just because the code works. Validate against Figma before delivering.

---

## 1. Required checklist

Before considering the task finished, confirm:

- [ ] HTML structure reflects the Figma hierarchy (no invented element, none removed without justification).
- [ ] Page skeleton matches `rules/page-structure.md`: sections are `<section class="sN">` in Figma order; a header block (when Figma has one) is `<header>`, not `sN`; the page NEVER has a `<main>` wrapper, with or without a header block; the footer is `<footer>`; every top-level block has exactly one container child (`.container` or a variant) controlling its lateral margin.
- [ ] All breakpoints of `rules/responsive.md` (1920, 1515, 1366, 1025, 890, 550, 390) render without breaking.
- [ ] Every desktop × mobile structural difference identified in the analysis is implemented — axis inversion (row ↔ column), grouping wrapper where one side groups and the other is flat, node present on one side only, rotation, reordering (`rules/responsive.md` section 3).
- [ ] Assets used are the originals from Figma (`rules/assets.md`), without approximation.
- [ ] Spacing (padding, margin, gap) matches what was measured in Figma.
- [ ] Typography (family, weight, size, line-height, letter-spacing) matches Figma.
- [ ] Alignment and positioning of every element matches Figma.
- [ ] Colors match the exact value extracted from Figma.
- [ ] Direct visual comparison (side-by-side screenshot) done on at least one desktop and one mobile breakpoint.
- [ ] No relevant console error/warning in the browser.
- [ ] Code without dead CSS/JS (unused rule, script with no function).
- [ ] No `@media` override repeats a value already set at a wider breakpoint/base rule for the same selector/property (`rules/html-css-js.md` section 2, "Cross-breakpoint redundancy check").
- [ ] Project slug ends in `-cpc`, `-org` or `-obrigada`; `index.html` has `<meta name="robots" content="noindex">` if `-cpc` or `-obrigada`, and does not have it if `-org` (`rules/project-naming.md`).
- [ ] If the page has a FAQ/accordion: opening one question closes any other that is open (single-open, never two at the same time), and the icon (chevron or `+`/`−`) switches state correctly on open/close (`rules/html-css-js.md` section 7.2).
- [ ] Every raster asset (non-SVG) in `assets/images/` is in `.avif` — no `.png`/`.jpg`/`.jpeg` in the final delivery (`rules/assets.md` section 5).
- [ ] Semantics: correct heading hierarchy (single `h1`, `h2`/`h3`+ without skipping a level), a real list uses `ul`/`li`, no invented HTML tag, every informative `<img>` with a real descriptive `alt` (decorative with `alt=""`) and `width`/`height` = the file's real dimension (`rules/html-css-js.md` sections 1/6, `rules/media.md` section 1).
- [ ] CSS units: no `min()`/`max()`/`clamp()` anywhere (`width`, fluid breakpoint interpolation or any other property — fixed `px` per breakpoint + `%`/flex instead); `font-size` only in `px` or `rem`; the same unit choice (`rem` or `px`) used consistently across the whole page (`rules/html-css-js.md` section 2, "Units").
- [ ] No `aspect-ratio` property anywhere in the CSS; images sized via `width`/`height` attributes (real dimension) + `px`/`%` CSS (`rules/media.md` section 1, `rules/html-css-js.md` section 2).
- [ ] No `vw`/`vh` anywhere in the CSS (margin, box height, or any other property) — only `px`, `%` or `rem` (`rules/html-css-js.md` section 2, "Units").
- [ ] No `flex` shorthand with a literal decimal `px` basis copied from Figma (e.g. `flex: 0 1 442.611px;`), unless truly necessary — and if used, the user was informed (`rules/html-css-js.md` section 2, "Units").
- [ ] No broken/decimal numbers anywhere in the CSS (any property, any breakpoint — e.g. `width: 40.83%;`, `padding: 23.4px`) — rounded to a clean value unless the exact value is genuinely required for Figma fidelity (`rules/html-css-js.md` section 2, "Units").
- [ ] No `margin: auto` (or `margin-left`/`margin-right: auto`) anywhere — centering done via flex/grid on the container instead (`rules/html-css-js.md` section 2, "Units").
- [ ] No `calc()` unless truly necessary (`rules/html-css-js.md` section 2, "Units").
- [ ] Lateral margins mapped against Figma per section; sections sharing the same lateral margin use one common content container (`max-width` + `width`/`%`, no `margin: auto`), sections with a different margin use their own container variant (`rules/html-css-js.md` section 2, "Side margins").

---

## 2. Differences found

When the visual comparison reveals a difference:

1. Record the difference (element, breakpoint, what diverges).
2. Fix it following the source of truth (Figma).
3. Revalidate after the fix.
4. Only consider it finished when there is no relevant difference pending.

A "relevant" difference = visible to the end user. A 1-2px difference from font/rendering rounding does not block delivery.

---

## 3. When not to validate alone

If the visual comparison points to an ambiguity (Figma and implementation diverge but it is not clear which one is right), ask the user before deciding — as per `rules/core.md`.
