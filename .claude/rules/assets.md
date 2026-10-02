# Assets Rule

## Objective

Ensure every asset used in the implementation is faithful to Figma, preserving structure,
proportion, quality and visual identity.

---

## 1. Priority

Always use the original asset available in Figma — treat it as the single source of truth. Never
replace an existing image/icon with an icon library, emoji, CSS, geometric shapes, a manually
recreated SVG, a generic image, or a placeholder (except section 12, when truly unavailable).

---

## 2. Identifying the asset in Figma

Before exporting: identify the node, check whether it is raster/SVG/icon/logo/illustration/
decorative/background, check whether it's a component or instance (find the original component
when it's an instance), and export the complete element for the visual usage — not just internal
parts of a component when the full asset is already available.

---

## 3. SVG

An SVG must be exported as a **complete element** — never fragment it to rebuild later in
HTML/CSS: no extracting individual paths, no turning parts into `<div>`, no recreating icons/logos
with CSS or text, no artificial splitting "to make it easier."

Preserve on export: original `viewBox`, proportion, paths, masks/gradients/clipPaths/filters — do
not redraw, recoordinate or simplify the geometry in a way that changes the visual result.

Use inline SVG when there is a real need (color change via CSS, hover, animation, internal
manipulation). Use `<img>`/an external file when it's static and purely visual.

---

## 4. Exporting SVG from Figma

Export the complete node as a single asset — do not export internal parts separately, do not
rebuild it later in the HTML. Two real-world quirks recur here: multiple sibling `imgVector*`/
`imgFrame*` URLs under the same parent are actually ONE icon (export the parent, not each
fragment), and exporting an `INSTANCE` of a remote component can silently return an all-transparent
file with no error. **Full procedure and both quirks: `rules/assets-export-details.md` section 4.**

---

## 5. Raster images

Export at the lowest resolution that keeps visual fidelity for the display size. **The final
format is always AVIF** — never deliver PNG/JPEG as the final asset when the node is not an SVG
(SVG never converts). If direct AVIF export isn't possible, download in the available format and
convert after (`scripts/convert-to-avif.mjs`, quality 75) — never sacrifice visible quality just
to shrink the file.

---

## 6. Optimization

Optimize only after exporting the original — never modify the only original file to solve a
performance problem; keep the original as reference even after generating an optimized version.
For raster → AVIF: the downloaded original (`png`/`jpg`) does NOT stay in `assets/images/` next to
the `.avif` — it goes only to `projects/<slug>/.audit/assets-original/` (outside final delivery).

---

## 7. Organization

Assets live in `projects/<slug>/assets/` — no subfolders by type without real volume need, except
these fixed ones: `assets/fonts/` (vendored fonts), `assets/vendor/` (vendored libs),
`assets/images/icons/` (≤64px intrinsic dimension), `assets/images/bgs/` (backgrounds/photos,
default category when in doubt), `assets/images/logos/` (brands/wordmarks).

---

## 8. Naming

Descriptive kebab-case based on content/usage (`hero-banner.avif`, `icon-check.svg`,
`logo-brand.avif`) — never a generic Figma name (`Vector 2`, `Frame 34`).

---

## 9. Integrity

Do not modify the original asset to solve an implementation problem — generate a derived version
and keep the original. Do not redraw/recreate/approximate an asset that already exists in Figma.

---

## 10. Validation

Before finalizing: confirm the original Figma asset was used, SVGs weren't fragmented/rebuilt,
proportion was preserved, nothing was manually recreated without need, the file is in
`projects/<slug>/assets/` with a descriptive kebab-case name, and any optimized version keeps
visual fidelity.

---

## 11. Asset x Layout

The asset is the visual content; HTML/CSS handle its positioning, size and behavior. Fix size,
position, alignment, spacing, responsiveness and scale problems in HTML/CSS — never edit or
deform the asset to compensate for a layout problem.

---

## 12. Asset not available

Do not manually recreate it, replace it with a library icon, use a visual approximation as
definitive, or reproduce it with CSS. Record it as a pending item; a clearly-marked placeholder is
fine only to keep the implementation moving, to be replaced by the original later.

---

## 13. Fonts

Every web font identified in Figma is downloaded and vendored in `projects/<slug>/assets/fonts/`
(never a Google Fonts/CDN `<link>`) — declared via `@font-face` pointing to the local file,
descriptive name (`inter-regular.woff2`), only the exact weights/styles actually used in Figma.

---

## 14. Triage before downloading — CSS-first

Before downloading, check whether CSS alone solves it (avoids an unnecessary file):

| Asset pattern                           | Decision                                              |
| --------------------------------------- | ----------------------------------------------------- |
| Horizontal divider/gradient fade        | CSS `linear-gradient()`                               |
| Vertical divider, solid line            | CSS `border-left`/`border-right`                      |
| Simple geometric shape                  | CSS `border-radius` + `background-color`              |
| Icon (any size), monochrome or not      | Download SVG (parent level) to `assets/images/icons/` |
| Logo/brand (raster; SVG logo stays SVG) | Download to `assets/images/logos/`, convert AVIF      |
| Photo/hero background                   | Download to `assets/images/bgs/`, convert AVIF        |

This is the same "Priority" rule (section 1) applied both ways: never use CSS to _recreate_ an
asset that exists in Figma; do use CSS for a purely geometric pattern that was never really an
asset.

---

## 15. Download procedure

`curl -sSL` from the Figma MCP asset URL into the right category folder; verify non-empty; **every
asset is always a real file — never inline as a base64 `data:` URI, regardless of size**; rasters
convert to AVIF with the original preserved only in `.audit/assets-original/`. **Full step-by-step:
`rules/assets-export-details.md` section 15.**
