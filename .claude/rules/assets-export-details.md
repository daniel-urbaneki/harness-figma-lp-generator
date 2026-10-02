# Assets Export Details

Figma-export quirks (`rules/assets.md` section 4) and the full download procedure
(`rules/assets.md` section 15). `assets.md` keeps only the short rule + pointer here —
read this file whenever actually exporting/downloading an asset from Figma.

---

## Section 4 — Exporting SVG from Figma, full procedure and quirks

When a visual element in Figma is an SVG:

1. Export the complete node.
2. Save the SVG as a single asset.
3. Do not export internal parts separately.
4. Do not rebuild the SVG later in the HTML.
5. Check that the exported SVG visually matches the original element.
6. Keep the exported original file as reference.

If the SVG is composed of several elements inside a frame/group, prioritize exporting the
complete frame/group when that set represents a single visual asset.

### Multi-fragment icon detection

When reading Figma design context (MCP), if two or more image URLs (`imgVector*`, `imgFrame*`
etc.) are children of the same COMPONENT/INSTANCE/GROUP/FRAME, they make up ONE single visual
icon — they are not independent assets. Record the common parent node and export ONE
consolidated SVG from it (`GET
https://api.figma.com/v1/images/:fileKey?ids=<parentNodeId>&format=svg`) instead of downloading N
fragments and trying to recompose them in HTML/CSS — that loses mask/gradient composition.

### Exporting an INSTANCE of a remote component can silently return an empty file

An `INSTANCE` node of a remote/external library component can have `get_metadata` reporting
children as `visible: false` even though the component renders visibly on the canvas via
`get_screenshot`. Exporting via REST:

- `GET /v1/images/:fileKey?ids=<instanceId>&format=svg` — may fail (override tree).
- `GET /v1/images/:fileKey?ids=<instanceId>&format=png&scale=N` — may fail **silently**: it
  returns a real image URL, HTTP 200, a real file on disk — and every pixel of the file is
  `(0,0,0,0)`. No error, nothing to catch except opening the file.

**Always check the actual pixel content of a freshly exported raster** before trusting it — check
that at least one channel has a non-zero maximum value.

**Fix, once detected:** export the node **one level up** — the GROUP or FRAME that directly wraps
the node that failed, not the node itself — through the same route (PNG or SVG).

---

## Section 15 — Download procedure, full steps

1. Use Bash `curl -sSL -o <path>` to fetch from the Figma MCP asset URL. Save it in the correct category folder (`rules/assets.md` section 7).
2. Check that the file exists and is not empty (0 bytes) after the download — silent failure happens (section 4 above).
3. **Every asset is always a real file — never inline as a base64 `data:` URI in the HTML/CSS
   source, regardless of size.** SVG stays a `.svg` file in `assets/images/<category>/`, referenced
   via `<img src="...">`/`background-image: url(...)`, the same as any other format (`avif`, `png`,
   `webp`). This applies even to a small icon (≤10KB) — file size is not a reason to inline. Inline
   `<svg>...</svg>` markup or a `data:` URI in the delivered code makes the asset unreviewable as a
   standalone file and invisible to `git diff`/asset tooling; keeping it as a file also lets the
   browser cache it independently across the page.
4. **If the node is not an SVG (raster — logo, photo, background):**
   1. Try `GET https://api.figma.com/v1/images/:fileKey?ids=<nodeId>&format=avif` first — if the API/MCP accepts it and returns `.avif` directly, use that file as the final one, with no conversion step. (Today the documented Figma REST API only supports `format=png|jpg|svg|pdf` — this attempt exists only so the path is not lost if support appears; never invent a success the response does not confirm.)
   2. If `format=avif` fails or is not supported, download in the available format (`png`/`jpg`) to a temporary/original file.
   3. Convert to AVIF: `node scripts/convert-to-avif.mjs <original> <destination.avif>` (uses `sharp`, default quality 75 — `rules/assets.md` section 5/6).
   4. Save the resulting `.avif` in `assets/images/<category>/<name-kebab-case>.avif` (`rules/assets.md` section 7/8).
   5. Preserve the original file (`png`/`jpg`) in `projects/<slug>/.audit/assets-original/<name-kebab-case>.<ext>` — never inside `assets/images/` next to the `.avif` (`rules/assets.md` section 6).
   6. Check that the `.avif` exists and is not 0 bytes (same care as step 2 — silent export failure happens).
5. Record every real file downloaded/converted (path, bytes, type) — never invent an asset path without a corresponding file/data URI.
