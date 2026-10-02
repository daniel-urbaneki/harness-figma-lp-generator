# Page Structure Rule

## Objective

Fix the top-level HTML skeleton every LP must follow — which wrapper tags exist, how
sections are named, and how each block controls its own lateral margin — so every build
(manual `/build-lp` or the `figma-to-html` pipeline) produces the same scaffolding instead
of reinventing it per project.

## Source of truth

`.claude/rules/references/estrutura.html` — canonical skeleton, comments included. Read it
whenever starting a new LP's HTML. Do not rewrite/simplify it; copy the pattern.

```html
<body>
  <!-- header only when Figma draws a distinct nav/header block (section 2) -->
  <header>
    <div class="container"></div>
  </header>
  <!-- every section goes directly under <body>, never wrapped in <main> -->
  <section class="s1">
    <div class="container"></div>
  </section>
  <section class="s2">
    <div class="container"></div>
  </section>
  <footer>
    <div class="container"></div>
  </footer>
</body>
```

## 0. Never use `<main>` — always flat

**`<main>` is never used on any LP of this project, with or without a header block.** From
`<body>` down, the structure is always flat: `<header>` (only if section 2 applies) →
`<section class="sN">` × N → `<footer>`. This is a fixed project convention — a deliberate
exception to the general semantic-HTML guidance that would otherwise call for `<main>`; do
not add it back for "correctness," and do not treat the presence/absence of a header block
as a condition for whether `<main>` appears — it never appears, period.

## 1. One `<section class="sN">` per Figma section, sequential

Each visual block Figma draws becomes one `<section>`, classed `s1`, `s2`, `s3`, ... in
document order (desktop `y` order). This is the same `sectionSlug`/`{prefixo}` already used
across the pipeline and the other rules (`rules/components.md`,
`.claude/skills/figma-to-html/SKILL.md` section-splitting heuristic) — this rule just fixes
it as the mandatory root class of the section tag itself, not only the CSS scope prefix.

- Do not name a section by its content (`.hero`, `.faq`) instead of `sN` — the numeric slug
  stays stable even if the section's content/name changes during the build; a descriptive
  class can still exist nested inside for readability, but the section's own class is `sN`.
- The footer and the header (when it exists) are the two exceptions — they use the semantic
  `<footer>`/`<header>` tag instead of `sN`, per sections 2 and 3.

## 2. Header — use `<header>`, not `sN`

When Figma draws a top nav/header bar as its own block (logo + menu + CTA, fixed/sticky at
the top, first section of the frame), implement it as `<header>` — not as `section.s1`.

If the Figma frame has no distinct header block (the first visual block is already regular
page content, not a nav bar), there is nothing to except — build sections normally,
starting straight from `<section class="s1">`. Either way (header or not), `<main>` never
appears (section 0).

## 3. Container — the only node that controls a block's lateral margin

Inside every top-level block (`<header>`, each `<section class="sN">`, `<footer>`), the
first structural child is a container element responsible for that block's lateral
margin/padding/content width — normally `<div class="container">`, or another semantic tag
when it fits better (e.g. `<nav>` inside `<header>` doubling as the container). This is the
concrete markup for the "Side margins" rule already defined in `rules/css-sizing.md`:

- Center that block's content via this container's `max-width` + `width: 100%` (or `%`) —
  never `margin: auto` on it or on its children (`rules/css-sizing.md`).
- **Same lateral margin across sections → same container class.** Reuse `.container` as-is;
  do not redeclare the same left/right padding per section.
- **Different lateral margin → a container variant**, not an override stacked on the shared
  class (e.g. `.container--narrow`, `.container--wide`) — one class per distinct margin
  value used on the page, decided by comparing every section's margin against Figma first
  (`rules/css-sizing.md`, "Side margins").
- Nothing outside this container sets the block's horizontal padding/margin — inner elements
  size themselves relative to the container, they do not add their own extra side
  margin/padding that duplicates what the container already does.

## Validation

Included in `rules/validation.md`: sections are `<section class="sN">` in Figma order (`s1`,
`s2`, ...); a header block (when Figma has one) is `<header>`, not `sN`; the page never has a
`<main>` wrapper, with or without a header block; the footer is `<footer>`; every top-level
block has exactly one container child driving its lateral margin, reusing `.container` where
the margin matches and a variant class where it does not.
