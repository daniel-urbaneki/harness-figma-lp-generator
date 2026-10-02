---
name: html-build
description: Builds the semantic HTML, scoped CSS and JS (only if there is real behavior) of a section or page, from the Figma analysis (figma-analysis) and the already downloaded assets (asset-management). Calls responsive-layout for the responsiveness step. Manual use, with no agent JSON schema — for 1 section/page at a time. Invoked by /build-lp.
---

# HTML/CSS/JS Build

Lightweight skill — runs directly in the main conversation, writing the final files into `projects/<slug>/`. It is not the multi-agent pipeline (`figma-to-html`) — that is for when the user wants the automatic parallel build with scoring; here it is direct construction, section by section or the whole page, with the user following along.

**Read all of `rules/html-css-js.md`, `rules/page-structure.md`, `rules/figma.md`, `rules/media.md` first.**

## Prerequisite

Run `figma-analysis` (and `asset-management` if the section has assets) before this skill. Do not start HTML without the analysis done (`rules/core.md`). If the analysis listed "Ambiguities found", resolve them with the user before writing any code — do not continue with a pending ambiguity.

If the section was marked as a carousel candidate (`rules/html-css-js.md` section 7.1) and the user
has not yet confirmed whether they want Swiper or a static list/grid, ask before writing any
HTML/CSS for that section — do not implement Swiper (nor rule it out) without that answer.

## When to use

- When the user asks for `/build-lp` or "build this section/page".

## Procedure

1. From the analysis already done, define the semantic structure (`<section>`, `<header>`, `<nav>`, etc — `rules/html-css-js.md` section 1). Apply the fixed skeleton from `rules/page-structure.md`: sequential `<section class="sN">` per Figma section, `<header>` (not `sN`) if Figma draws a top nav/header block, `<footer>` for the last section when it is a footer, a container child (`.container` or a margin variant) as the first structural child of every top-level block, and never a `<main>` wrapper anywhere on the page (with or without a header block). **Consult the "Desktop × mobile differences" and the "Elements that need grouping"** that `figma-analysis` recorded (`rules/responsive.md` section 3): the structure has to serve both sides from the start. Grouping wrappers and DOM order are decided here — afterwards, with CSS alone, you cannot reparent an element.
2. Write the HTML — hierarchy matches Figma, standard HTML5 tags only (never invent a custom
   tag), real headings (single `h1`/`h2`/`h3`+ without skipping a level), lists in `ul`/`li`, real
   descriptive `alt`/`alt=""` as appropriate (`rules/html-css-js.md` sections 1/6), `width`/`height`
   at the real dimension of the asset, adjusted by CSS when the layout calls for a different size
   (`rules/media.md` section 1), no `loading="lazy"`, pure UTF-8 with no entities.
3. Write the CSS — CSS variable for reused tokens, descriptive kebab-case class (never a Figma node name), scoped per section when the page has multiple sections, no `!important`/inline style except for documented exceptions.
4. If the section has a carousel, FAQ/accordion, or a YouTube video — follow `rules/html-css-js.md` section 7.1/7.2 or `rules/media.md` section 5 (canonical standard, vendored lib, never reinvent).
5. Write JS only if there is real behavior (`rules/html-css-js.md` section 3) — one file per behavior or `main.js` if the volume is small.
6. Call the `responsive-layout` skill to apply the breakpoints.
7. Reference the assets already downloaded by `asset-management` — never invent a path, never approximate with CSS/library icon when the original asset exists.
8. Web fonts used: confirm they are vendored in `assets/fonts/` (one file per weight, `rules/assets.md` section 13) — download now if `asset-management` has not done it yet, since only now do you know the weights actually used in the final CSS.
9. Check the slug suffix (`-cpc` or `-org`, `rules/project-naming.md`): if `-cpc`,
   include `<meta name="robots" content="noindex">` in the `<head>` of `index.html`; if
   `-org`, do not include that tag. If the slug does not have one of the two suffixes, stop and
   ask the user before writing the `<head>`.
10. Write/update `projects/<slug>/index.html`, `css/style.css` (or `css/<section>.css` if the project has already grown big enough to split), `js/main.js`.

## Rules

- Do not invent an element that is not in Figma. Do not remove an element without justification.
- Do not duplicate HTML structure to simulate responsiveness — that is `responsive-layout`'s job, within the same HTML.
- Do not install a new dependency without explicit authorization (`CLAUDE.md`) — already authorized libs: `lite-youtube-embed`, Swiper (both vendored, `rules/media.md`/`rules/html-css-js.md`).
- Do not consider the section finished without going through `visual-validation` afterwards.

## Output (answer in the conversation)

Summary of what was written/updated (files, main lines), and what is still pending (unavailable asset, unresolved ambiguity) — forward the pending item to the user before continuing.
