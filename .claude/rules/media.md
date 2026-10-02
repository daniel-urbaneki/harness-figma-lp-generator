# Media Rule

## Objective

Ensure image, video and audio embedded in the LP are performant without losing visual fidelity to Figma.

---

## 1. Image

- Use `<img>` with explicit `width`/`height`, always the real (intrinsic) dimension of the
  exported file — not the display size in the layout (this avoids layout shift, and the browser
  uses it to compute the correct ratio). If the display size needs to be different (responsive,
  scaling per breakpoint), adjust it via CSS (`max-width`, `width: 100%`, `height: auto`,
  `object-fit`, etc.) — never change the `width`/`height` attributes to a value different from
  the real dimension of the file just to "force" the display size.
- **Never use the CSS `aspect-ratio` property.** Keep images sized via `width`/`height`
  (attributes with the real dimension, per above) plus CSS in `px` or `%` only
  (`rules/html-css-js.md` section 2, "Units") — do not reach for `aspect-ratio` as a shortcut to
  keep proportion. If an implementation hits an extreme case where this approach truly does not
  work, stop and ask the user before switching to `aspect-ratio` or any other property — do not
  decide it alone (`rules/core.md`, Ambiguity).
- Never use `loading="lazy"`, on any image, even below the fold. Native lazy-loading only fires the request when the viewport actually intersects the element — that has already caused a broken image (`naturalWidth: 0`) in automated validation (full-page screenshot, social preview crawler and print/PDF export never "scroll" to the element, so the request never fires). For the typical image weight of an LP, the performance gain does not offset that risk. All images load eager.
- `srcset`/`sizes` when the same asset has size variation per breakpoint (`rules/responsive.md`).
- Format: always AVIF for raster (`rules/assets.md` section 5) — never deliver PNG/JPEG as the final asset when the node is not an SVG. SVG never converts to AVIF (it stays SVG).
- Descriptive `alt` on informative images, `alt=""` on decorative ones (`rules/html-css-js.md`).

---

## 2. Video

- Native `<video>`, no external player/lib, unless authorized.
- `poster` always defined (Figma frame or a frame of the video itself).
- `preload="metadata"` by default; `preload="auto"` only if the video is critical above the fold.
- Autoplay only if Figma/the request demands it — always `muted` + `playsinline` together with `autoplay`.
- A decorative background video must not block the page load (lazy/defer).
- Native controls (`controls`) when the video is content, not decoration.

---

## 3. Audio

- Native `<audio>`, no autoplay without user interaction (browser policy + UX).
- Visible controls whenever the audio is the main content.

---

## 4. General performance

- Video and heavy iframe/embed (YouTube) do not block the page load below the fold (`preload="metadata"`, `lite-youtube-embed`, section 5) — this "do not load without need" rule does NOT apply to `<img>`, which always loads eager (see section 1).
- Compress video/image preserving visual fidelity — never sacrifice perceptible quality for file weight (`rules/assets.md`, Integrity section).

---

## 5. YouTube

Always use it when Figma (or the request) shows a YouTube video: thumbnail with play button, "assistir o vídeo" card, embedded Shorts.

### Canonical lib — lite-youtube-embed

- Every YouTube video is embedded via **lite-youtube-embed** (`github.com/paulirish/lite-youtube-embed`), never a raw `<iframe src="youtube.com/embed/...">`, never `youtube-nocookie.com` as a substitute.
- Reason: `lite-youtube-embed` loads only the thumbnail + play button; the heavy YouTube iframe (which loads the full player JS) only comes in after the click.
- **Authorized exception** to the "do not use external libs" rule of `CLAUDE.md` — dependency approved by the user, specific to YouTube embeds.
- Download and vendor it in `assets/vendor/lite-youtube-embed/{lite-yt-embed.css,lite-yt-embed.js}` — never via CDN (`rules/assets.md`, section 7). If the vendor folder already exists in a sibling build in another `projects/<slug>/`, copy it from there instead of downloading it again.
- Load it once in the `<head>`: `<link rel="stylesheet" href="assets/vendor/lite-youtube-embed/lite-yt-embed.css">` + `<script src="assets/vendor/lite-youtube-embed/lite-yt-embed.js" defer></script>`. Deduplicate if more than one section of the page embeds a video.

### Placeholder until there is a real ID — never an empty `<lite-youtube>`

`<lite-youtube>` fires a real request for the thumbnail (`i.ytimg.com/vi/<id>/hqdefault.jpg`) the moment it is connected to the DOM — an empty/placeholder id gives an immediate 404. Until a real video id exists, render a simple poster+play placeholder, never the live component:

```html
<button type="button" class="card card--1" aria-label="Assistir vídeo 1">
  <span class="poster"></span>
  <span class="play"
    ><img
      src="assets/images/icons/icon-play.svg"
      alt=""
      aria-hidden="true"
      width="110"
      height="110"
  /></span>
</button>
```

One button per video slot, numbered sequentially (`--1`, `--2`, ...).

### Swap script — when the real ID is provided

The user provides the 11-character id (from `youtube.com/shorts/<id>`, `youtu.be/<id>`, or `youtube.com/watch?v=<id>`) per slot. A small, scoped script only swaps the card when the id is not empty — that is what stops an unfilled slot from becoming a live element:

```js
(function () {
  var YT_IDS = { 1: "", 2: "" }; // fill in the id when provided; '' keeps the placeholder
  Object.keys(YT_IDS).forEach(function (n) {
    var videoId = YT_IDS[n];
    if (!videoId) return;
    var card = document.querySelector(".card--" + n);
    if (!card) return;
    var lite = document.createElement("lite-youtube");
    lite.className = card.className;
    lite.setAttribute("videoid", videoId);
    lite.setAttribute("playlabel", "Assistir vídeo " + n);
    lite.setAttribute("params", "playsinline=1");
    card.replaceWith(lite);
  });
})();
```

- Keep the `poster`/thumbnail faithful to what Figma shows for the video card.
- Never invent a video id — a slot with no id stays on the placeholder.
- Never hand-write a custom "lite" embed (`<img>` lazy + click-injects-iframe) — the vendored lib already solves that, including thumbnail fallback and `noscript` indexing.

---

## 6. Full-bleed / page background images

A large decorative background image that intentionally extends beyond its own frame ("bleed") —
common for a page-wide texture/photo positioned behind the whole layout — needs the same
positional fidelity as any other element, not a generic `background-size: cover;
background-position: center` guess.

- **Always implement any decorative/background image as CSS `background-image` on the
  container, never as an `<img>` inside a `<div>` positioned with `position: absolute`.**
  This applies to every background layer (single full-bleed image, layered composition —
  texture + masked photo + gradient fade, per the mobile-vs-desktop bullet below — divider,
  etc.), on every breakpoint. An `<img>` is for informative/content visuals (`alt` matters,
  section 1); a page/section background is decorative and belongs in CSS. Reproduce the exact
  crop/bleed with `background-size`/`background-position` in `px`/`%` (never `cover` as a
  default, see bullet below) instead of `width`/`height`/`left`/`top` on a positioned `<img>`.
  A `mask-image` (see the CORS bullet below) still applies the same way, on the same
  `background-image` element. Applies retroactively — fix an existing LP still using the
  `<img>`+`position:absolute` pattern for backgrounds when the task touches it.
- **Read the real bbox, don't eyeball it.** Get the node's `x`/`y`/`width`/`height` relative to its
  parent frame (same coordinate convention used for section placement, `rules/figma.md`). If the
  image (e.g. 2199×1538) is larger than the frame (e.g. 1920×1276) and offset (e.g. `x=-140,
y=-289`), that offset is the real crop — reproduce it with explicit `background-size` (the
  image's real pixel dimensions) and `background-position` (the real offset, converted to
  `px`/`%`) on the container, not `cover`/`center`. A generic cover-fit silently shows a
  different crop than Figma, usually not noticeable until compared side by side.
- **`cover` is a last-resort fallback, not a shortcut.** If the page's real content height varies
  by breakpoint (text reflow, not a fixed Figma frame) and a literal positioned image falls short of
  covering the full page at some breakpoint (a flat-color seam appears below it), do not reach for
  `background-size: cover` to "solve" it by default — `cover` rescales the image to fill a
  taller-than-intended box, which drags bleed content (e.g. a statue/character positioned near an
  edge) toward the center, potentially back on top of text/cards a layout offset was specifically
  built to avoid (see `rules/responsive.md`/this file's own LP history). Compare both defects with
  the user before choosing — a subtle same-tone seam is often the smaller problem.
- **Desktop and mobile can be genuinely different compositions, not the same image scaled.** Before
  reusing the desktop background for mobile breakpoints, check the Figma mobile frame's own
  background node(s) — it may be a different crop, a different asset, or (as observed) multiple
  layered assets (a texture layer + a photo clipped by an SVG mask shape + a gradient fade), which
  no amount of scaling the desktop asset reproduces. If mobile really has no separate background
  data, that is a real finding to confirm with the user, not an assumption to make silently.
- **CSS `mask-image`/`clip-path` referencing an external SVG file fails under `file://`.** A masked
  background layer (`mask-image: url("assets/.../shape.svg")`) loads fine over `http`/`https`
  (same-origin), but Chromium blocks it as a CORS violation when the page is opened via `file://`
  (each `file://` document is treated as a unique "null" origin) — this breaks this project's own
  validation tooling (`scripts/render-html-screenshot.mjs`, opened via `file://`) and any direct
  local preview, even though production hosting would work. Fix: embed the mask as an inline
  `<svg><mask id="…">` in the HTML (using the exact path data from the real downloaded SVG file,
  kept in `assets/` as the source of truth) and reference it via `mask-image: url("#id")` — a
  same-document fragment reference is never cross-origin. This is a narrow, technical exception to
  "always a real file, never inline" (`rules/assets-export-details.md` section 15) that applies
  only to `mask-image`/`clip-path` element references, not to normal image assets.
- Set `overflow-x: hidden` on **both** `html` and `body` when a background layer is deliberately
  wider than the viewport (bleed) — `overflow-x: hidden` on `body` alone does not clip content that
  overflows `html`'s own scrollable area, so a wide absolutely-positioned background silently grows
  the page's horizontal scroll/screenshot width.
- **A background image the user drops manually into `assets/images/bgs/` always wins over a
  Figma-MCP export/bbox recomputation, even when the math checks out.** Background crops/bleeds are
  a recurring problem area in this project: the real bbox math (node `x`/`y`/`width`/`height` vs
  frame) can be verified correct and still not match how the layout actually needs to render,
  because of how the specific frame clips/composites in Figma vs how the built page's own flow
  height differs from the frame's nominal height. When the user says "use this file instead" /
  hands over a background they exported themselves, swap the asset in directly (convert to AVIF,
  resize `background-size`/`background-position` to fit it) — do not re-derive "the correct crop"
  from Figma metadata and second-guess the file they gave you. Ask only for the numbers needed to
  wire it in (which breakpoint, does it replace desktop/mobile/both), not whether their crop is
  right.
