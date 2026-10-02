---
name: responsive-layout
description: Applies or reviews the responsive behavior of an already built section/page, across the project's 7 fixed breakpoints — same HTML structure, real override from the Figma mobile frame when it exists, marked interpolation when it does not. Manual use, with no dedicated command — called inside /build-lp or on its own when the user asks to review responsiveness.
---

# Responsiveness

Lightweight skill — runs directly in the main conversation. It has no command of its own; it is called as part of `/build-lp` (the Responsiveness step of the workflow) or on its own when the user asks ("adjust the mobile of this section", "review the breakpoints").

**Read all of `rules/responsive.md` first.**

## When to use

- After the base HTML/CSS (desktop) of a section is written, before considering the section finished.
- When the user reports a visual break at a specific breakpoint.

## Fixed breakpoints (do not use another value without an explicit request)

`1920` (desktop, base) → `1515` → `1366` → `1025` → `890` → `550` → `390` (mobile).

Only `1920` and `390` (approximation of 430) have a real frame in Figma — the other 5 are interpolated (`rules/responsive.md` section 2).

## Procedure

1. Confirm whether the section has a mobile frame in Figma (check the `figma-analysis` result). If it does, the `@media (max-width: 390px)` values come from there — color, spacing, typography, real position, never estimated.
   1b. Re-read the **"Desktop × mobile differences"** recorded by `figma-analysis` (`rules/responsive.md`
   section 3) and check that each one is implemented — not just spacing/size:
   - **axis inversion** (row ↔ column): does the `@media` invert the `flex-direction`?
   - **divergent grouping**: does the wrapper exist in the HTML, shared by both sides, and is it
     neutralized on the flat side (`gap` equal to the parent's, or `display: contents`)? If the HTML was
     written without that wrapper, **CSS does not solve it** — go back and fix the structure (section 3.2).
   - node on one side only, rotation, reordering, alignment.
2. If it has no mobile frame: interpolate by engineering judgment, and mark it in the CSS with a comment (`/* mobile interpolado do desktop — sem frame Figma correspondente */`) — do not let that pass as real Figma fidelity.
3. For the 5 intermediate breakpoints (1515/1366/1025/890/550): **never `clamp()`/`vw`/`vh`** — use `%`/flex (fluid, unit-based) for what can scale that way, and pin a fixed `px` value per breakpoint via `@media` for everything else (font-size, gap, padding, etc.), computed between the 1920 and 390 values (`rules/css-sizing.md`). Skip a breakpoint's own rule only when the interpolated value there would be within ~2px of the nearest already-pinned one.
4. Keep the SAME HTML structure across breakpoints. Solve differences via CSS. Only change the structure if Figma shows genuinely different content/composition (`rules/html-css-js.md`, `rules/responsive.md`).
5. Do not hide an element on mobile just because it is easier — only if Figma shows that.
6. Do not change text/image/order just to make responsiveness easier.
7. If Figma shows a genuinely different image on mobile (not just the same one resized), use `<picture>`/`<source media>` — never duplicate the element in the DOM.

## Quick validation

- Test visually (or via `visual-validation`) at least at: 1920, 390, and one intermediate (e.g. 1025).
- Check that nothing breaks, overlaps or gets cut off at intermediate widths between the fixed breakpoints.
