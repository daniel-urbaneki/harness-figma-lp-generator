---
name: asset-management
description: Exports, triages and organizes the assets of an already analyzed section/page (figma-analysis) — decides CSS-first vs download, categorizes into icons/bgs/logos/fonts/vendor, downloads via curl, validates that the file is not empty. Manual use, directly on the main thread, with no JSON schema. Invoked by /extract-assets.
---

# Asset Management

Lightweight skill — runs directly in the main conversation. Assumes the section has already been analyzed (`figma-analysis`) and that a list of candidate asset nodes exists.

**Read all of `rules/assets.md` first** — it is the source of every rule used here (priority, SVG, CSS-first triage, download, organization, naming, unavailable asset).

## When to use

- After `/analyze-figma` on a section, before writing HTML that references those assets.
- When the user asks for `/extract-assets` or "download this section's assets".

## Inputs

- List of candidate asset nodes (from the previous analysis), or the user points at a specific node.
- Project `slug` (folder `projects/<slug>/`).

## Procedure

1. For each candidate node, apply the CSS-first triage (`rules/assets.md` section 14) — if it can be solved with `linear-gradient`/`border`/`border-radius`, download nothing, record that it stayed CSS-only.
2. For what remains, identify the type (SVG/raster), the category (`icons`/`bgs`/`logos`, section 7) and whether it is a multi-fragment icon (section 4 — in that case, request the consolidated SVG from the parent node, never the fragments).
3. Download via Bash `curl -sSL -o <path>` (section 15) to `projects/<slug>/assets/images/<category>/<kebab-case-name>.<ext>` (from Figma).
4. **If the node is raster (non-SVG): always convert to AVIF** (`rules/assets.md` section 5/15) —
   try `format=avif` directly in the Figma export first; if it is not supported (which is the case today),
   download `png`/`jpg` normally and run `node scripts/convert-to-avif.mjs <original> <destination.avif>`.
   The final delivered file is always `<kebab-case-name>.avif` in `assets/images/<category>/`; the
   downloaded original goes only to `projects/<slug>/.audit/assets-original/` as a reference, never
   to `assets/images/` alongside the `.avif`. SVG never goes through this conversion — it stays SVG.
5. Verify that each downloaded/converted file exists and is not 0 bytes. If it is raster, check that it
   is not 100% transparent (gotcha from section 4 — a remote component instance can export empty,
   silently) before converting.
6. For SVG ≤10KB: read it, convert to base64, decide with the user (or by default, if it is used only once) whether it becomes an inline data URI instead of a separate file.
7. If an asset identified in the analysis cannot be exported, follow `rules/assets.md` section 12 — record it as a pending item, do not recreate it manually, placeholder only if needed to continue.
8. Web fonts used in the section: download and vendor them into `assets/fonts/`, one file per weight (section 13) — not at this stage if the page does not yet have the final list of weights used; it can wait until `html-build` runs.

## Output (answer in the conversation)

```markdown
## Assets — <section name>

**Solved with CSS only:** <list>
**Downloaded:**

- `assets/images/icons/icon-check.svg` (2.1KB) → inline data URI
- `assets/images/bgs/hero-bg.avif` (38KB, converted from the original `hero-bg.png` — preserved in `.audit/assets-original/`)

**Pending item (asset not available):** <list, if any>
```

## Rules

- Never replace an existing, available asset with a library icon, an emoji, CSS recreating the visual, or an approximation.
- Never fragment an SVG.
- Never modify the original asset — optimization produces a derived version and preserves the original.
- File name always descriptive kebab-case, never `Vector 2`/`Frame 34`.
