# Asset Handling Rules

> Loaded by: `agents/asset-reviewer.md`
> Purpose: pipeline-specific mechanics to turn `BuildOutput` + `extractionAssets`
> into an `AssetOutput`. The general asset policy (CSS-first triage, SVG export, download,
> folder organization, naming) is in `rules/assets.md` — read that first, it applies to
> any implementation. This file covers only what is specific to the schema/agent.

## Inputs you receive

- `sectionId`
- `buildOutput` — the builder's full `BuildOutput` JSON
- `extractionAssets` — `{ desktop: Asset[], mobile: Asset[] | null }`, the `assets` arrays of `extraction.desktop`/`extraction.mobile`
- `outputSlug`

## Output contract

Return a JSON matching the Zod schema `AssetOutput` in `scripts/schemas.mjs`:

```json
{
  "sectionId": "1:427",
  "htmlPatched": "<section>... (placeholders replaced) ...</section>",
  "cssPatched": ".s1-hero{ background-image: url('assets/images/bgs/hero-bg.avif') }",
  "assetFiles": [
    {
      "path": "projects/minha-landing/assets/images/bgs/hero-bg.avif",
      "bytes": 38200,
      "type": "image/avif"
    }
  ]
}
```

Raster (non-SVG) always delivers `.avif` in `assetFiles`/the final reference — never `.png`/`.jpg`
(`rules/assets.md` section 5/15). The original file downloaded before the conversion (when the direct
AVIF download was not possible) does not go into `assetFiles` nor into `assets/images/` — it only stays in
`projects/<outputSlug>/.audit/assets-original/` as reference.

## Dedupe between desktop and mobile

Before applying the triage/download (`rules/assets.md` sections 14–15), compare `extractionAssets.desktop` with `extractionAssets.mobile` (when not `null`) by `figmaUrl`:

- **Same `figmaUrl` on both sides** → it is the same visual asset, only displayed at a different size via CSS. Download it ONCE only.
- **Different `figmaUrl` for the same visual slot** → Figma shows a genuinely different image on mobile. Download both files — the mobile placeholder has the `-mobile` suffix (e.g. `s1-asset-0-mobile`) so you know which downloaded file goes in which marker (the builder already assembles the `<picture>`/CSS override for that, see `html-generation.md`).

## Placeholder replacement

For every `data-asset-placeholder="<id>"` in `buildOutput.html`:

1. Find the corresponding asset by its position in the `assets` array of the right side (desktop, or mobile if the id has the `-mobile` suffix).
2. Replace:
   - The placeholder was a standalone `<img>` → set `src` to the final reference, remove `data-asset-placeholder`.
   - The placeholder has a diverging desktop+mobile pair → assemble a `<picture>` with `<source media="(max-width: 390px)" srcset="...">` + an `<img>` fallback, per `html-generation.md`.
   - The placeholder was a background `<div>` → move the reference to `cssPatched` as `background-image` in a new class (or inside the `@media` if it is the mobile variant).

## Rules

- DO NOT modify semantics (HTML structure) — only swap asset references.
- DO NOT call Figma MCP directly — use only URLs already present in `extractionAssets`.
- YOU MAY remove `data-asset-placeholder` attributes after the replacement.
- YOU MUST keep every `data-figma-id` intact.
- YOU MUST follow `rules/assets.md` for everything that is not specific to this contract (triage, SVG export, download, naming, folder organization).

## Validation

Check mentally against the Zod schema `AssetOutput` in `scripts/schemas.mjs` before returning.
