# HTML / CSS / JS Rule

## Objective

Generate semantic HTML, organized CSS and minimal JavaScript, keeping fidelity
to the structure, visuals and behavior defined in Figma.

The implementation must reproduce the Figma design without introducing structures,
styles or behaviors that are not necessary.

---

## 1. HTML

- Use semantic tags (`header`, `nav`, `main`, `section`, `article`, `footer`)
  when the semantics apply. Avoid a generic `<div>` when an adequate tag exists.
- Structure reflects the Figma hierarchy: section → group → component → element.
  One `<section>` per main visual block when appropriate. Keep element order
  consistent with Figma. Do not add/remove elements just for implementation
  convenience.
- **Fixed page skeleton — see `rules/page-structure.md`.** Sections are `<section
class="sN">` in Figma order (`s1`, `s2`, ...); a header block, when Figma draws one, is
  `<header>` (not `sN`); the page NEVER uses `<main>`, with or without a header block —
  structure is always flat (`<header>` → `sN`× → `<footer>`); every top-level block
  (`header`/`sN`/`footer`) has one container child (`.container` or a variant) that alone
  controls its lateral margin, per the "Side margins" rule below.
- **Never invent a custom HTML tag** (e.g. `<custom-card>`) — only standard HTML5 tags.
- **Real heading hierarchy, not visual:** single `<h1>` per page; `<h2>` per main
  section; `<h3>`+ for subdivisions. Never skip a level. A visually "title-looking"
  text that is not semantically a section/content title uses `<p>`/`<span>` — heading
  is a semantic decision, not a style one.
- **A list of items uses `<ul>`/`<li>`** (cards, menu items, features) — `<div>`/`<span>`
  are for pure visual grouping, not a list substitute.
- Descriptive `alt` on informative images (never empty/generic/filename); `alt=""` on
  purely decorative images (WCAG standard, not an omission).
- Do not duplicate structure to simulate responsiveness (no `.desktop-only`/`.mobile-only`
  of the same content) — solve breakpoint differences with CSS/media queries; different
  structures only when Figma itself shows genuinely different content/composition.
- Pure UTF-8, never an HTML entity for a printable character (`ç`, `ã`, `—` etc. literal).
  Only exception: reserved chars in text nodes (`&lt;`/`&gt;`/`&amp;`).
- Never `loading="lazy"` on `<img>` — see `rules/media.md` section 1 for the reason.

---

## 2. CSS

### Structure

- Use CSS variables (`:root`) for tokens that are really reused (colors, typography,
  recurring spacing, radius, shadows) — not for arbitrary one-off values.
- Classes represent a function/component/pattern, `kebab-case`, descriptive
  (`.hero-title`, `.card-price`) — never Figma-internal names (`frame-34`, `vector-5`).

### Fidelity to Figma

Visual values (typography, size, weight, line-height, letter-spacing, colors, spacing,
borders, radius, shadows, alignment, dimensions, positioning) come from Figma exactly —
no approximation, no "close enough", no convenience substitution.

### Units, side margins, redundancy check — see `rules/css-sizing.md`

Full rules and reasoning live in `rules/css-sizing.md`. Short version, always enforced:

- No `min()`/`max()`/`clamp()`/`vw`/`vh`/`aspect-ratio`/`margin: auto` anywhere; `calc()`
  only when truly unavoidable. `font-size` only `px`/`rem`. Everything else `px`/`%`
  (fixed values pinned per breakpoint via `@media`, not fluid formulas).
- No broken/decimal numbers — round to a clean value unless the exact value is genuinely
  required for Figma fidelity.
- One shared content container per lateral-margin group (`max-width` + `width`, not
  `margin: auto`) — see "Side margins" in `rules/css-sizing.md`.
- Pick `rem` or `px` once for the whole page's `font-size` and keep it consistent.
- Cross-breakpoint redundancy check: never repeat at a narrower `@media` a value already
  set at a wider one for the same selector/property — see `rules/css-sizing.md`.
- Gradient-on-text gotcha (`background-clip: text` + a non-`NORMAL` blend mode fill) —
  see `rules/css-sizing.md`.

### Organization

- One main CSS file per LP in `css/`, split by section only when it becomes hard to
  navigate. Logical order: variables → reset/base → global elements → reusable
  components → sections → responsiveness → specific states.

### Best practices

- No `!important` without real documented need; no inline `style=""` except for
  JS-driven dynamic values.
- Avoid excessively specific selectors, unnecessary HTML-element dependence, duplicated
  or unused CSS, preventive styles without need.
- Do not use `@media` to fix problems solvable by the base layout structure.

---

## 3. JavaScript

- Only when there is real behavior (mobile menu, carousel, accordion, tabs, modal,
  scroll spy, anchor nav, form, or an interaction defined in Figma) — never to solve
  what HTML/CSS already solves, never "preventive" JS for behavior not requested.
- Vanilla JS by default; no framework/external lib without need or authorization.
- One file per behavior when responsibilities need separating; `main.js` when the
  volume is small. Init only after required DOM elements exist. No duplicated
  listeners, no initializing components that do not exist on the page.

---

## 4. Performance

- Load only what the page needs — no external libs/JS/third-party resources without
  need, no JS for purely visual/CSS-solvable effects.
- Do not unnecessarily block initial render; below-the-fold behavior can init
  non-blocking. Never trade visual fidelity or Figma-defined behavior for performance.

---

## 5. IDs

- Only when really necessary (anchors, JS hooks, external tool integration) — never for
  styling, never generic/sequential (`#div1`, `#section2`). Descriptive when used;
  prefer classes otherwise.

---

## 6. Accessibility

- Semantic HTML throughout; `alt` rule per section 1. `<button>` for actions, `<a>` for
  navigation — no clickable `<div>`/`<span>` replacing native interactive elements
  without need. Keep focus states; never strip `outline` without an accessible
  alternative. Heading hierarchy per section 1.

---

## 7. Standard components

Required patterns for recurring interactive components — do not reinvent per LP. Full
markup/CSS/JS for each is in **`rules/components.md`** — read it only when the component
below is actually in play.

### 7.1 Carousel — Swiper 11, vendored

**Detection is not an automatic decision.** A candidate (horizontal scroll row, coverflow,
"carousel"/"slider"/"galeria" in Figma, more items than fit on screen) only gets built as a
functional carousel after **asking the user** — even if the same pattern recurred in a
previous LP of the same client (`rules/core.md`, Ambiguity). If "no": static list/grid, no
Swiper, no arrows. If "yes": canonical lib is Swiper 11, always vendored (never CDN,
never another lib) — full markup/CSS gotchas/JS init in `rules/components.md`.

### 7.2 FAQ / Accordion — div pattern + single-open toggle

For a Figma FAQ/"Dúvidas Frequentes" with a collapse/expand icon (not a static always-open
Q&A). `div`-based markup (never `<details>`/`<summary>`), single-open always, icon is
chevron-rotate or `+`/`−` (CSS-only, whichever Figma shows — ask if unclear). Full
markup/CSS/JS in `rules/components.md`.

---

## 8. Implementation rule

Before creating HTML, CSS or JS: consult Figma structure → identify reusable
components/patterns → check available assets → define semantic structure → implement
HTML → implement styles → implement only necessary behaviors → validate desktop and
mobile → remove unused code.

Do not create code ahead of time for problems that do not exist yet.

The complete workflow (including Correction and Delivery) is the one defined in `CLAUDE.md` — do not duplicate it here.
