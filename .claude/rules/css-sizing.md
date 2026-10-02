# CSS Sizing Reference

Full detail for `rules/html-css-js.md` section 2 ("Units", "Side margins", cross-breakpoint
redundancy, the gradient-text gotcha). `html-css-js.md` keeps only the short rule statements and
points here for the reasoning/examples.

---

## Units — fixed standard, no `min()`/`max()`

- Never use CSS `min()`, `max()` or `clamp()` — not on `width`, not on any other property
  (`height`, `padding`, `margin`, `gap`, `top`/`left`/etc.), and not even for the fluid
  interpolation between the 1920 and 390 breakpoints described in `rules/responsive.md` section
  2 — that interpolation uses `%`/flex plus fixed `px` values pinned per breakpoint via `@media`,
  never a `clamp()`/`vw` formula. Use only `%` or fixed `px`.
- `font-size` accepts only `px` or `rem` — never `%`, `em`, `vw`/`vh`, `min()`/`max()`/`clamp()`.
- Never use the CSS `aspect-ratio` property, on images or anything else — size images via
  `width`/`height` attributes + `px`/`%` CSS instead (`rules/media.md` section 1). Ask the user
  before deviating to `aspect-ratio` or another property, only in a genuine extreme case.
- Never use `vw`/`vh` — for `margin`, box height, or any other property. Use `px`, `%` or `rem`
  instead (`rem` only for `font-size`, per above; `px`/`%` for everything else — margin, padding,
  width, height, gap, etc.).
- Avoid the `flex` shorthand with a literal decimal `px` basis copied straight from Figma (e.g.
  `flex: 0 1 442.611px;`) — that value is an internal Figma computation for that exact frame, not
  a real design token, and it breaks the moment the item's content or container changes. Use it
  only when there truly is no other way to reproduce the layout, and **tell the user when it is
  used** so they know it needs a closer look (`rules/core.md`, Ambiguity).
- Avoid broken/decimal numbers anywhere in the CSS — not just `font-size`/`width`, every property
  (`height`, `padding`, `margin`, `gap`, `top`/`left`, `border-radius`, etc.) and at every
  breakpoint (e.g. `width: 40.83%;`, `font-size: 15.7px`, `padding: 23.4px`) — a raw value copied
  from a Figma computed measurement, not a real design token. Round to a clean, sensible value
  (`px`: whole number; `%`: whole number or at most one decimal only when rounding would create a
  visible fidelity gap) unless the exact broken value is genuinely required for the layout to
  match Figma. Applies to the whole page, whether building it new or adjusting an existing one.
- Avoid `margin: auto`/`margin-left: auto`/`margin-right: auto` on the page's elements. Center
  content via the container's layout instead — flex (`justify-content: center`/`align-items:
center`) or grid — matching how Figma's own `auto layout` centers the frame, rather than
  relying on `auto` margins on the child.
- Avoid `calc()` — use it only when there truly is no other way to express the value with a plain
  `px`/`%`/`rem` (per above).
- Note: the ban on `min()`/`max()` above is on the CSS _functions_. The **properties**
  `max-width`/`min-width` (and `max-height`/`min-height`) are not affected — they are allowed,
  with a `px` or `%` value, including as the mechanism for the side-margin container below.

## Side margins — one content container per shared margin

Concrete markup convention (which tag holds the container, where it lives inside
`header`/`section`/`footer`, `.container` vs a variant class): `rules/page-structure.md`.
This section keeps the sizing/grouping reasoning.

Most LPs use a standard lateral margin (page gutter) repeated across sections, with some
sections using a smaller or larger one. Before building/adjusting a page:

- Map every section's lateral margin against Figma — do not assume every section shares the same
  value; some are intentionally narrower/wider.
- Group every section that shares the same lateral margin under one content container (e.g. a
  reusable `.container`/`.content-wrap` class), instead of repeating the same left/right
  padding or margin declaration section by section. A section with a different margin gets its
  own container variant (e.g. `.container--narrow`), not an override on top of the shared one.
- Center that container's content with `max-width` (the container's capped content width) plus
  `width: 100%` (or `%`) — `px`/`%` values only, per the units rule above. Do not center it with
  `margin: auto` (previous bullet) — use the container's own layout (flex `justify-content:
center` on the parent, or the container sized and positioned by the section's flex/grid).
- **Pick one unit for the whole page and never mix it**: at the start of the build, decide either
  `rem` or `px` for every `font-size` (and keep that same choice for other length values where a
  relative unit would apply) — do not clone a page using `rem` in one section and `px` in
  another. Consistency across the full LP matters more than which of the two is chosen.
- Reason: `min()`/`max()`/`clamp()`/mixed units are a recurring source of subtle sizing bugs found
  during LP development (unpredictable resolved value across breakpoints, inconsistent scale
  against the rest of the page) — `%`/`px` fixed per breakpoint give a predictable, directly
  Figma-traceable value.

## Cross-breakpoint redundancy check

Before finishing a section (and again in `rules/validation.md`), compare each `@media` override
against the same selector/property already set at a wider breakpoint (base rule or a larger
`@media`). If the value is identical, the declaration is dead weight — remove it, the wider rule
already cascades down.

Example: `.x { left: 0; top: 0; width: 100%; height: 100%; }` at the base/desktop rule, then the
exact same four declarations repeated inside `@media (max-width: 890px)` for `.x` — the 890px
block adds nothing and must be deleted (or trimmed to only the properties that actually change at
that breakpoint). This check runs every time a breakpoint is added or edited, not only at the end
of a build.

## Gotcha — text with solid fill + gradient

If a text node in Figma has a second fill with a `blendMode` other than `NORMAL`
(commonly `SOFT_LIGHT`) over a `SOLID` base, and the reproduction uses `background-image:
linear-gradient(...)` + `background-clip: text` + `color: transparent`, it is MANDATORY to also
set `background-color: <the solid one>` and `background-blend-mode: <the fill's real blendMode>` in the
same rule. `background-clip: text` clips the WHOLE background stack to the glyph outlines —
without a base color layer, any alpha-0 stop in the gradient leaves the glyph literally
transparent to whatever is behind the page. Read the `blendMode` of each individual fill (field of the
item in the array), never assume `NORMAL`.
