# Responsiveness Rule

## Objective

Ensure desktop, tablet and mobile faithfully reproduce the responsive behavior defined in Figma — never assume mobile is just a shrunken desktop.

---

## 1. Principle

- Elements can change position, size, alignment or structure between breakpoints — check Figma at each one, do not extrapolate from desktop.
- Desktop and mobile must use the same HTML structure whenever possible.
- Only use a different HTML structure between breakpoints when Figma really defines different content or composition.

---

## 2. Breakpoints

Fixed build standard, from largest to smallest — the desktop layout is the base, adjust at each break:

| Breakpoint | Reference            |
| ---------- | -------------------- |
| `1920px`   | Desktop (build base) |
| `1515px`   | Notebook             |
| `1366px`   | Notebook             |
| `1025px`   | Tablet               |
| `890px`    | Tablet               |
| `550px`    | Mobile               |
| `390px`    | Smaller mobile       |

- Always build in this order: 1920 → 1515 → 1366 → 1025 → 890 → 550 → 390.
- These breakpoints are fixed for the project — do not use a different value without an explicit request.

### Which breakpoints have a real frame in Figma

The Figma of this project normally only draws **2 sizes per section**: desktop **1920** and mobile
**430**. That is, out of the 7 fixed breakpoints above:

- **`1920px`** — matches the Figma desktop frame exactly. Direct source of truth.
- **`390px`** — the mobile breakpoint closest to the Figma mobile frame (430). Use the mobile
  frame (430) as the real reference for this breakpoint — the 40px difference is normalized
  (proportionally) in the comparison/validation, it does not affect the CSS built.
- **`1515px`, `1366px`, `1025px`, `890px`, `550px`** — have no frame of their own in Figma. They
  are interpolated/proportional between the desktop layout (1920, real) and the mobile layout
  (390, real or interpolated) — use `%`/flex (fluid, unit-based) to scale between the two extremes,
  with an explicit `@media` rule pinning a fixed `px` value at each of these breakpoints when
  Figma or plain layout sense calls for a composition break there. **Never use `clamp()`** (e.g.
  `clamp(16px, 13.96px + 0.523vw, 24px)`) or any `vw`/`vh`-based formula to interpolate — only
  fixed `px` values (per breakpoint, via `@media`) or `%` (`rules/html-css-js.md` section 2,
  "Units").
- If a Figma section has no mobile frame matching the desktop one (rare, but it happens), the
  mobile of that section is interpolated by engineering judgment, not extracted — record that
  (a comment in the CSS or a pending item) so it does not pass as real Figma fidelity.

---

## 3. Desktop × mobile comparison — mandatory before building

Analyze both frames **in parallel, node by node**, before writing any HTML for the section. Do not
build the desktop first and "discover" the mobile later: the HTML structure has to be born already
serving both sides, because it is the **same** structure (section 1). Discovering an axis flip or
a grouping only when writing the `@media` normally means redoing the HTML.

What to compare in each matching container (same node in both frames):

| What to check                                                             | Where to look in Figma                           | Why it matters                                                          |
| ------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| **Axis direction** — row ↔ column                                         | frame `layoutMode` (`HORIZONTAL`/`VERTICAL`)     | the most common difference, and the one that breaks most when assumed   |
| **Grouping** — one side groups children in a sub-frame, the other is flat | children count/depth differs                     | **not solvable with CSS alone** — needs a wrapper in the HTML (see 3.2) |
| **Child order**                                                           | `y`/`x` coordinate of the children on each side  | may require `order` or `column-reverse`                                 |
| **Node present on only one side**                                         | node with no pair in the other frame             | single element in the HTML + `display: none` on the side that lacks it  |
| **Alignment / distribution**                                              | `primaryAxisAlignItems`, `counterAxisAlignItems` | changes `justify-content`/`align-items` per breakpoint                  |
| **Rotation of the same vector**                                           | `rotation` of the node                           | same asset, different orientation (vertical divider → horizontal)       |
| **Spacing**                                                               | `itemSpacing`, `padding*`                        | gap/padding have their own value per side, not proportionally scaled    |

Record every difference found **before** building — that is what defines the HTML structure and
which `@media` blocks will exist.

### 3.1 Direction flip (row ↔ column)

When the same frame has a different `layoutMode` between sides, the base CSS takes the desktop
direction and the `@media` flips it. Never infer the mobile direction from the desktop one.

Example: a contact block is a **column** on desktop (phone above the link) and a **row** on
mobile (the two side by side) —

```css
.{prefixo}-contact {
  display: flex;
  flex-direction: column;
}
@media (max-width: 767px) {
  .{prefixo}-contact {
    flex-direction: row;
  }
}
```

### 3.2 Grouping that exists on only one of the sides

Subtler case: one side groups N children in a sub-frame of its own (with its own `itemSpacing`)
and the other side has the same children **flat** in the parent container. CSS **cannot reparent
an element** — so the HTML needs the wrapper, and it exists at both breakpoints.

This does **not** violate "do not duplicate structure to simulate responsiveness" (section 4): it
is **one** wrapper shared by both sides, not a `.desktop-only`/`.mobile-only` pair. What the rule
forbids is duplicating the same content; here the content is single.

Two ways to neutralize the wrapper on the side that has the flat children:

- **`gap` identical to the parent's** — if the `itemSpacing` of the flat side equals that of the
  parent container, a nested flex with the same `gap` reproduces the flat row exactly. It only
  works when the values coincide (e.g. 37px on both sides).
- **`display: contents`** — the general solution when the values do not coincide: the wrapper
  leaves the layout tree and the children start participating directly in the grandparent's flex.
  Use it only on a pure grouping `<div>`; avoid it on a semantic element (`ul`/`li`, `table`),
  where it can break semantics and accessibility.

Mark the wrapper with a comment when it has no equivalent node on one of the sides, to keep
traceable what is Figma structure and what is a synthetic wrapper — e.g. when a group exists
as a node only on mobile, `data-figma-id` carries only the mobile id.

### 3.3 No mobile frame

If the section has no mobile frame in Figma, there is no comparison to make — it falls under the
marked interpolation rule of section 2 (comment in the CSS, recorded as a pending item). Never
treat interpolation as if it were extracted data.

---

## 4. Implementation

- Solve layout differences via CSS/media query.
- Do not duplicate content in the DOM to simulate responsiveness (no `.desktop-only`/`.mobile-only` of the same block).
- The grouping wrapper (section 3.2) is a legitimate exception: it is a single shared structure, not duplication.
- Do not hide an element on mobile just because it is simpler to implement — hide it only if Figma shows that.
- Do not change content (text, image, order) just to make the responsive implementation easier.

---

## 5. Validation

- Visually validate each breakpoint against the corresponding Figma frame.
- Check that elements do not break, overlap or get cut off at intermediate widths between the defined breakpoints.
- Check that every difference recorded in the section 3 comparison (axis flip, grouping, node on one side only, rotation, order) is in fact implemented — not just spacing/size.
