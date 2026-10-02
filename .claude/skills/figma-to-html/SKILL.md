---
name: figma-to-html
description: Orchestrates Figma → HTML/CSS/JS vanilla pipeline using multi-agent pattern. Splits a Figma landing frame into sections, dispatches per-section pipelines in parallel (cap 4), aggregates results, runs a final visual evaluation, and runs a correction loop (up to 5x) for each section that fails the minimum score.
---

# Figma → HTML Orchestration Skill

You are the orchestrator. You never write HTML or download an asset yourself. You plan, dispatch, aggregate, verify.

## Pipeline overview

The Figma of this project only draws 2 sizes per section — desktop 1920 and mobile 430 (`rules/responsive.md` section 2) — so each section is extracted, built and evaluated on both sides.

**Before step 1**, three prerequisites — do not proceed with the pipeline without all three resolved:

1. **Two Figma links** (`rules/figma.md`, "Selection links"): **desktop** root frame (1920) and
   **mobile** root frame (430), both with `node-id`, provided by the user. Ask for both at once
   if the user did not provide both — never infer the mobile one on your own.
2. If the project (`projects/<slug>/`) does not exist yet, ask the user the production URL of the
   page (the slug is exactly that URL, ending in `-cpc` or `-org` —
   `rules/project-naming.md`).
3. **Local MCP active.** Figma reading is always through the **local** Dev Mode MCP server
   (`http://127.0.0.1:3845/mcp`), never the remote one. Ask the user whether it is active **in the
   same message** in which you ask for the links from prerequisite 1 — the server goes down when
   the Figma app closes, so never assume. If it is inactive or the `mcp__figma__*` tools do not
   respond, guide the user to enable it (`rules/figma.md`, section "MCP server") and **stop until
   it is resolved** — do not proceed with estimated data, do not fall back to the remote server and
   do not switch to the REST path (`scripts/figma-rest.mjs`) without explicit user authorization.

```
1. mcp__figma__get_metadata(desktop root frame AND mobile root frame) → matches N sections between the two
2. For each section (in parallel waves of ≤4):
     figma-analyzer (extracts desktop+mobile) → [carouselCandidate? ask the user] → frontend-builder (single build, base+@media 390) → asset-reviewer
                                                                                                      │
                                                                     visual-reviewer(breakpoint=desktop) │ visual-reviewer(breakpoint=mobile)
                                                                                                      │
                                                        any score < 0.90? ────────────────────────────┤
                                                                                                      │
                                             YES → frontend-builder (correction, issues from both breakpoints) → revalidate both (loop, max 5)
                                             NO  → done
3. Aggregate all section fragments into projects/<slug>/index.html + css/ + js/ + assets/
4. Render the full page in the 2 viewports via scripts/render-html-screenshot.mjs
5. Run the global visual-reviewer 2x (full-page desktop 1920 vs Figma 1920; full-page mobile 390 vs Figma 430 resized)
6. If any global evaluation fails, dispatch corrections only to the sections with the worst score at that breakpoint
7. Write projects/<slug>/.audit/README.md with the score (desktop and mobile) and the number of iterations per section
```

## Carousel confirmation (candidate detected)

After the `figma-analyzer` runs of a wave return, and BEFORE dispatching `frontend-builder`
for the sections of that wave: check `carouselCandidate` in each `ExtractionOutput`.

- No section with `carouselCandidate: true` → dispatch `frontend-builder` normally.
- One or more → stop that wave and ask the user, all at once (one question per candidate
  section, all together if the wave has more than one), whether to implement it as a Swiper
  carousel or a static list/grid in each one (`rules/html-css-js.md` section 7.1) — never decide
  on your own, even if the pattern is recurrent (e.g. a carousel of professors shows up in several
  landings, but confirm again in each build). Store each section's answer as
  `carouselDecision: "swiper" | "static"`.
- Dispatch the section's `frontend-builder` only after having `carouselDecision` defined, passing
  that value in the input (together with `extraction`, `mode`, `sectionSlug`).
- Sections without `carouselCandidate` go on without that field in the builder input.

## Agent roles (mapped to the project's 4 agents)

| Role in pipeline    | Agent              | Does                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extractor           | `figma-analyzer`   | Extracts 1 Figma section — desktop AND mobile, when it exists — → `ExtractionOutput` JSON (tokens, assets, layout, screenshot of both sides). Never writes HTML, never downloads an asset.                                                                                                                                      |
| Builder + Corrector | `frontend-builder` | Builds the section's semantic HTML/CSS/JS from the `ExtractionOutput` — base CSS from the desktop side, `@media (max-width: 390px)` from the mobile side (`BuildOutput`). Also applies corrections when the `visual-reviewer` reports issues, respecting each issue's `breakpoint` (`CorrectionOutput`). Never calls Figma MCP. |
| Asset processor     | `asset-reviewer`   | Downloads, categorizes and integrates the section's assets into the HTML/CSS (`AssetOutput`), deduplicating between desktop/mobile by URL, following `rules/assets.md`. Never calls Figma MCP directly — only uses already extracted URLs.                                                                                      |
| Evaluator           | `visual-reviewer`  | Compares the rendered HTML vs the Figma screenshot AT ONE breakpoint per call (desktop or mobile), computes a composite score (SSIM + layout IoU + color overlap) via Node scripts, lists issues marked by `breakpoint` (`EvalOutput`). Never suggests a fix, only describes the problem.                                       |

## Section-splitting heuristic

1. Call `mcp__figma__get_metadata` on the two root frames the user provided — **desktop**
   (1920) and **mobile** (430), each by the `node-id` of its link. Do not look for the mobile frame
   on your own. Fallback (only if the user said they do not have the mobile link, or asked you to infer it):
   look for the ~430-wide frame that is a sibling of the desktop one on the same Figma page and **confirm with the
   user which node was chosen** before dispatching any agent (`rules/figma.md`, "Selection
   links").
2. List the direct children of each one. Keep only children where `type === 'FRAME'` and `height > 200` — those are the sections.
3. Sort each frame's sections by ascending `y` coordinate.
4. **Match a desktop section with a mobile section** by order + name similarity (e.g. desktop "Hero" with mobile "Hero", same index). When the name matches AND the order matches, it is a reliable match.
5. If the number of sections differs between desktop and mobile, or a desktop section has no obvious mobile candidate (name/order do not match confidently), **stop and ask the user before dispatching** (`rules/core.md`, ambiguity) — do not guess the match. You may proceed only with the sections that matched confidently and report the rest as pending items, if the user prefers.
6. Assign a sequential `sectionSlug` — `s1`, `s2`, ..., `sN` — based on the desktop order.
7. A desktop section without a reliable mobile counterpart (and the user authorized proceeding that way): dispatch the `figma-analyzer` with `mobileSectionNodeId: null` for it.
8. This is only the section split — whether the first one is a `<header>` (`isHeader`) instead
   of a numbered `sN` section is detected by the `figma-analyzer` itself per section
   (`rules/page-structure.md`), not decided here.

If the landing has no sub-frames (rare), treat the whole frame as a single section.

## Concurrency rule

NEVER dispatch more than 4 section pipelines in a single message. Landings with more than 4 sections are processed in waves:

- Wave 1: sections 1–4 in parallel (one message, 4 agent dispatches)
- Wait for all 4 to return
- Wave 2: sections 5–8
- etc.

## Validation at each step

Every subagent returns JSON. Validate against the Zod schema in `scripts/schemas.mjs` before passing it on to the next agent:

```bash
node -e "
import('./scripts/schemas.mjs').then(m => {
  m.ExtractionOutput.parse(JSON.parse(process.argv[1]));
  console.log('ok');
}).catch(e => { console.error(e.message); process.exit(1); });
" '<subagent json>'
```

If validation fails, re-dispatch the subagent with the error message in the input.

## Correction loop

Each section keeps TWO score histories in memory — `historyDesktop` and `historyMobile` (the latter only really exists if `extraction.mobile` is not `null`; otherwise evaluate mobile too, but treat it as an interpolated fallback, not as a Figma fidelity failure).

After the `visual-reviewer` runs the 2 passes (`breakpoint=desktop`, `breakpoint=mobile`) for the section:

1. Append `scoreDesktop` to `historyDesktop` and `scoreMobile` to `historyMobile`.
2. Call `node scripts/corrector-guard.mjs` for each history separately: `'{"history":[...historyDesktop],"threshold":0.90,"maxIter":5}'` and the same for mobile.
3. If EITHER of the two returns `continue: true`, dispatch `frontend-builder` (correction mode) ONCE, passing the combined issues from both `EvalOutput`s (each already with its `breakpoint`). The builder applies the fixes in the right block (base or `@media`) — see `correction-patterns.md`.
4. Re-dispatch `visual-reviewer` on both breakpoints, append the new scores to the respective histories, repeat.
5. Stop when BOTH histories return `continue: false`. Record each one's `reason` (threshold-met, max-iter, stalled) in the section report.

## Aggregation

After all sections finish:

1. Concatenate the `html` fragments in section order. **Never wrap the concatenation in
   `<main>`** — the page is always flat, `<header>` (only if some section's
   `ExtractionOutput` has `isHeader: true`, already returned as `<header>...</header>` from
   the builder) → `<section class="sN">` × N → `<footer>`, per `rules/page-structure.md`
   section 0. This holds whether or not any section is a header — `<main>` never appears.
2. Concatenate each section's `css` fragments into `projects/<slug>/css/style.css`. Deduplicate font family/weight comments between sections, and then self-host the fonts (see below) — NEVER leave a `<link>`/`<link rel="preconnect">`/`@import` of `fonts.googleapis.com`/`fonts.gstatic.com` in the final output.
3. Concatenate each section's `js` fragments (the `js` field of `BuildOutput`, one block per section already scoped by `sectionSlug`) into `projects/<slug>/js/main.js`, in the same section order. A section without behavior returns `js: ""` and contributes nothing.
4. **Deduplicate third-party CDN/vendor tags.** If any section fragment references Swiper (`assets/vendor/swiper/...`) or `lite-youtube-embed` (`assets/vendor/lite-youtube-embed/...`), keep only ONE instance of each `<link>`/`<script>` in the final `<head>` — even if 3 sections bring the same reference. Compare by the full URL/path, not by the tag string.
5. Wrap it in a complete document, CSS and JS as external files (`rules/html-css-js.md`):

   ```html
   <!doctype html>
   <html lang="pt-BR">
     <head>
       <meta charset="utf-8" />
       <meta name="viewport" content="width=device-width, initial-scale=1" />
       <!-- <meta name="robots" content="noindex" /> — only if the slug ends in -cpc (rules/project-naming.md) -->
       <title>{{landingName}}</title>
       <link rel="stylesheet" href="css/style.css" />
       <!-- vendor <link> (swiper, lite-youtube-embed) deduplicated here, if used -->
     </head>
     <body>
       {{aggregatedHtml}}
       <!-- vendor <script> (swiper, lite-youtube-embed) deduplicated here, if used -->
       <script src="js/main.js" defer></script>
     </body>
   </html>
   ```

6. Write to `projects/<slug>/index.html`.

## In correction mode

The `frontend-builder` (correction mode) returns a `CorrectionOutput` with `htmlPatched`, `cssPatched` and `jsPatched` for the section. When re-aggregating, replace that section's block in `css/style.css`/`js/main.js` with the patched content — never re-aggregate the sections that did not change.

### Font self-hosting (mandatory, replaces the Google Fonts CDN)

See `rules/assets.md` section 13 — one file per weight, no dedupe by subset. For each family+weight collected in step 2 of the aggregation:

1. Fetch the Google Fonts CSS2 endpoint with a modern browser `User-Agent` (needed to receive `woff2` instead of a legacy format):
   ```
   curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
     "https://fonts.googleapis.com/css2?family=<Family>:wght@<weight>&display=swap"
   ```
   One call per weight actually used in Figma — do not download the whole family.
2. Parse the returned `@font-face` block, keep only the `latin` subset (covers Portuguese with accents; ignore the other subsets unless explicitly needed).
3. Save to `projects/<slug>/assets/fonts/` named `<font-name>-<weight>.woff2` (e.g. `inter-regular.woff2`, `inter-bold.woff2`) — one file per weight, without deduplicating between weights even if the font is variable and the physical file is the same.
4. Write the local `@font-face` rule at the top of `css/style.css`, with a local `src: url('assets/fonts/<file>.woff2')`, one rule per weight.
5. In the `<head>`, add `<link rel="preload" as="font" type="font/woff2" crossorigin href="assets/fonts/<font-name>-regular.woff2">` for each family's regular weight. Do NOT add a `<link>` or `<link rel="preconnect">` to `fonts.googleapis.com`/`fonts.gstatic.com`.

## Audit output

Every run writes:

- `projects/<slug>/.audit/extraction.json` — array of the extractor outputs (desktop+mobile per section)
- `projects/<slug>/.audit/evaluation-final.json` — final evaluator report, desktop and mobile
- `projects/<slug>/.audit/screenshots/figma-full-desktop.png` — full screenshot of the desktop Figma frame (1920)
- `projects/<slug>/.audit/screenshots/figma-full-mobile.png` — full screenshot of the mobile Figma frame (430)
- `projects/<slug>/.audit/screenshots/html-full-desktop.png` — screenshot of the HTML rendered at 1920
- `projects/<slug>/.audit/screenshots/html-full-mobile.png` — screenshot of the HTML rendered at 390
- `projects/<slug>/.audit/assets-original/` — original raster (`png`/`jpg`) of each asset converted to AVIF, preserved as reference (`rules/assets.md` section 6)
- `projects/<slug>/.audit/README.md` — readable summary with the score (desktop and mobile) and iterations per section

All of this stays inside `.audit/`, outside the final delivery (see `CLAUDE.md`, Structure section) — already gitignored. No audit file goes in the root of `projects/<slug>/` next to `index.html`.

## What you never do

- Never call Figma MCP yourself (the `figma-analyzer` owns that)
- Never write HTML (the `frontend-builder` owns that)
- Never download an asset (the `asset-reviewer` owns that)
- Never compute a score by hand (the `visual-reviewer` and the Node scripts own that)
