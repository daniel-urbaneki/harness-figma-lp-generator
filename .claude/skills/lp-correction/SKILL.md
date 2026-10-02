---
name: lp-correction
description: Applies corrections directly to the already written HTML/CSS/JS, from the differences found by visual-validation. Edits the final files directly (no schema CorrectionOutput) and revalidates afterwards. Manual use, 1 section/page at a time. Invoked by /fix-lp.
---

# LP Correction

Lightweight skill — runs directly in the main conversation, editing `projects/<slug>/index.html`/`css/`/`js/` with `Edit`. It is not the automatic loop of the `figma-to-html` pipeline (that one recomputes the score via schema and repeats up to 5x on its own); here each correction is discussed/confirmed with the user when there is ambiguity.

**Read `rules/validation.md` section 2 first.**

## Prerequisite

Run `visual-validation` before — it needs the list of differences found. Do not "guess" what to fix without a validation that pointed out the problem.

## When to use

- When the user asks for `/fix-lp`, or after a `visual-validation` that found a relevant difference.

## Procedure

1. For each difference in the list (`rules/validation.md` section 2, step 1 — element, breakpoint, what diverges), apply the fix following the source of truth (Figma):
   - layout offset → check the container's margin/padding/gap/align, or whether the element is in the wrong container;
   - wrong color → check whether it came from a token or a literal hex; if literal, swap it for the right token/value extracted from Figma;
   - missing element → go back to the analysis, add it;
   - extra element → remove it;
   - different text → copy it exactly from Figma;
   - wrong size → check the asset dimension or explicit `width`/`height` vs `max-width`.
2. If the correction is at a mobile breakpoint, apply it inside the correct `@media` — never let it leak into the desktop block.
3. If the difference has no obvious fix, or Figma and the implementation seem genuinely in conflict, ask the user before deciding (`rules/validation.md` section 3).
4. After applying the fixes, run `visual-validation` again on the same section — only consider it resolved when there is no relevant difference left pending.

## Rules

- Do not alter the original asset to compensate for a layout problem (`rules/assets.md` section 11, Asset x Layout) — the fix goes in HTML/CSS.
- Do not introduce dead CSS/JS while correcting (a rule that became obsolete gets removed, not left behind).
- Do not remove an element without justification while correcting.

## Output (answer in the conversation)

Short changelog: what changed, why (citing the difference from the validation), and whether the revalidation confirmed it resolved.
