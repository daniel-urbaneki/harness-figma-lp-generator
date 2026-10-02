---
name: visual-validation
description: Validates an already built section/page against Figma — checklist of structure, breakpoints, assets, spacing, typography, alignment, color, with visual comparison (side-by-side screenshot, optionally SSIM/IoU/color score via the existing Node scripts). Manual use, with no agent JSON schema. Invoked by /validate-lp.
---

# Visual Validation

Lightweight skill — runs directly in the main conversation. It can reuse the generic Node scripts in `scripts/` (SSIM, layout IoU, color overlap) for an objective number, but the main driver is the checklist in `rules/validation.md` — it is not the automatic correction loop of the `figma-to-html` pipeline (that one is multi-agent, with schema and score history; here it is a manual check, with the user in the loop).

**Read all of `rules/validation.md` first.**

## When to use

- Before considering a section/page finished (`CLAUDE.md`: "never consider the task finished without validation").
- When the user asks for `/validate-lp` or "check whether this section matches Figma".

## Procedure

1. Run the FULL required checklist (`rules/validation.md` section 1, read it in full — the list
   below is only a reminder of the categories, not a substitute for the actual file) against the
   section/page:
   - HTML structure reflects the Figma hierarchy;
   - breakpoints (1920, 1515, 1366, 1025, 890, 550, 390) render without breaking;
   - assets are the originals from Figma, with no approximation;
   - spacing, typography, alignment, color match what was measured/extracted;
   - no relevant console error/warning;
   - no dead CSS/JS;
   - **CSS hygiene** (`rules/css-sizing.md`): no `min()`/`max()`/`clamp()`/`vw`/`vh`/`aspect-ratio`/
     `margin: auto`, `calc()` only if truly necessary, no broken/decimal numbers, no cross-breakpoint
     redundancy, lateral margins grouped into a shared container per `rules/html-css-js.md` "Side
     margins".
2. Visual comparison — at least 1 desktop breakpoint and 1 mobile:
   - Figma screenshot at `projects/<slug>/.audit/screenshots/<nodeId>-desktop.png`/`-mobile.png` (saved by `figma-analysis`) vs screenshot of the rendered HTML (via browser, or `node scripts/render-html-screenshot.mjs screenshot <htmlPath> <outPng>` at the right viewport). If that file does not exist, `figma-analysis` was not run for this section (or ran before this step existed) — run it again before comparing.
   - Optional, if you want an objective number: `node scripts/compute-ssim.mjs <figma.png> <rendered.png>` (dimensions have to match — use `node scripts/render-html-screenshot.mjs resize` if the Figma mobile frame is 430 and the render is 390).
3. Assemble the list of differences found (`rules/validation.md` section 2): element, breakpoint, what diverges.
4. If there is ambiguity about which one is right (Figma vs implementation diverge, but it is not clear which prevails), ask the user before deciding (`rules/validation.md` section 3, `rules/core.md`).

## Output (answer in the conversation)

```markdown
## Validation — <section/page name>

- [x] Structure ok
- [x] Breakpoints ok (tested 1920/1025/390)
- [ ] Asset `hero-bg.jpg` — color slightly darker than Figma (#0F172A vs #142033 in the render)
- [x] Typography ok
- [x] No console error

**Relevant differences:** <list, or "none">
```

A 1-2px difference from font/rendering rounding is not a blocker — only report it if it is noticeable.

## Afterwards

If there is a relevant difference, forward it to `lp-correction` (or `/fix-lp`) with the list of differences found here.
