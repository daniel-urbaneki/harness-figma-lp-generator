# Standard Components Reference

Full patterns for `rules/html-css-js.md` section 7 (Carousel, FAQ/Accordion). Read this
file only when one of those components is actually in play — `html-css-js.md` section 7 keeps
just the short rule (ask-first behavior, canonical lib) and points here for markup/CSS/JS.

---

## 7.1 Carousel — Swiper 11, vendored

**Canonical lib — Swiper 11, always vendored.** Do not use another lib (Slick, Splide, custom
JS) without an explicit request, nor `<marquee>`/a CSS-only pseudo-carousel. Download
`swiper-bundle.min.{css,js}` once and vendor it in `assets/vendor/swiper/` — never a CDN
(same rule as YouTube, `rules/media.md` section 5). Load it once in the `<head>`
(`<link>`/`<script defer>`), deduplicate if more than one section uses it.

**Required markup:**

```html
<div class="{prefixo}-swiper-wrap">
  <div class="{prefixo}-swiper swiper">
    <div class="swiper-wrapper">
      <div class="swiper-slide">
        <div class="{prefixo}-slide"><!-- card --></div>
      </div>
    </div>
  </div>
  <button
    class="{prefixo}-swiper-btn {prefixo}-swiper-btn--prev"
    aria-label="Slide anterior"
    type="button"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  </button>
  <button
    class="{prefixo}-swiper-btn {prefixo}-swiper-btn--next"
    aria-label="Próximo slide"
    type="button"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  </button>
</div>
```

- `.swiper-wrapper`/`.swiper-slide` are native Swiper classes — never rename them.
- **Transform gotcha:** Swiper writes `transform: translate3d(...)` inline on every
  `.swiper-slide` on each frame — it overrides any stylesheet `transform` on that element.
  Every state `scale`/`rotate` (coverflow etc.) MUST live on the inner `.{prefixo}-slide`,
  never on `.swiper-slide`. Opacity is safe on `.swiper-slide` (Swiper does not touch it).
- Navigation buttons: inline SVG, never an external image.
- Init at the end of `<body>`/`js`, inside `window.addEventListener('load', ...)` with the guard
  `if (typeof Swiper === 'undefined') return;`, selector scoped per instance (not a generic
  class repeated if there is more than one carousel on the page).
- Default `slidesPerView` breakpoints (adjust density to the design, not the position of the
  breakpoints — see `rules/responsive.md` for the layout breakpoints):
  mobile `1.4`, 640px `2`, 900px `3`, 1280px `4`, 1600px `5`.

---

## 7.2 FAQ / Accordion — div pattern + single-open toggle

**Markup:** `div`-based, never `<details>`/`<summary>` (full control over the transition and
icon rotation):

```html
<div class="{prefixo}-item">
  <div class="{prefixo}-question"><span>Pergunta</span><span class="{prefixo}-icon"></span></div>
  <div class="{prefixo}-answer">Resposta</div>
</div>
```

- `.{prefixo}-answer` starts at `max-height: 0; overflow: hidden`, expands via the `.active` class on
  the parent `.{prefixo}-item` (never on `.answer` itself).
- **Single-open, always**: opening an item closes any other that is open — never two
  items open at the same time. Every clicked question closes the others before (or together with) opening the
  clicked one, even if it was already closed. Multi-open only if Figma explicitly shows
  several open at the same time — it is not the default, it is an exception that needs evidence in the design.
- **State icon — check which one Figma uses, both are supported standards:**
  - **Chevron/arrow**: rotates 180° via `.active .icon` (`transform: rotate(180deg)`) applied to an
    `<img>` pointing at the downloaded SVG file (`assets/images/icons/`, `rules/assets.md` section
    14/15) — never inline as a `data:` URI, the CSS `transform` rotates the `<img>` element itself,
    no need for inline markup.
  - **`+`/`−` (plus turns into minus)**: never download it as an asset — it is a simple geometric shape (two
    bars), fully solved with CSS (`rules/assets.md` section 14, CSS-first). The closed icon shows
    `+`; the open one shows `−`. Implementation: two bars via pseudo-elements, one horizontal
    (`::before`) always visible, one vertical (`::after`) that shrinks to zero in the open state —
    the result is only the horizontal bar, that is, the `−`:

    ```css
    .{prefixo}-icon {
      position: relative;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
    .{prefixo}-icon::before,
    .{prefixo}-icon::after {
      content: "";
      position: absolute;
      top: 50%;
      left: 50%;
      background: currentColor;
      transform: translate(-50%, -50%);
      transition: transform 0.2s ease;
    }
    .{prefixo}-icon::before {
      width: 100%;
      height: 2px;
    }
    .{prefixo}-icon::after {
      width: 2px;
      height: 100%;
    }
    .{prefixo}-item.active .{prefixo}-icon::after {
      transform: translate(-50%, -50%) scaleY(0);
    }
    ```

  Do not mix the two patterns in the same section — use the one Figma shows for that
  component. If it is not clear which of the two Figma draws, ask the user
  (`rules/core.md`, Ambiguity) instead of assuming.

- **Answer content missing in Figma:** a FAQ accordion is usually designed collapsed,
  with no answer text exported anywhere in the node tree. When that happens: do not
  fabricate a specific factual answer (price, policy, certification — it becomes misinformation);
  check whether there is equivalent adaptable content in a sibling page of the same project; otherwise, use a
  clearly marked placeholder (`"Resposta em breve — conteúdo a ser definido."`) and record it
  as a pending item (`rules/assets.md` section 12, same principle for content).
- Name the JS variable and the CSS class scoped per instance — it avoids a collision if there is more than one
  FAQ block on the same page.

**Canonical JS** (single-open toggle — the `.active` on `.{prefixo}-item` already handles both the
answer expansion and the icon switch, chevron or `+`/`−`, via CSS):

```js
(function () {
  var items = document.querySelectorAll(".{prefixo}-item");
  items.forEach(function (item) {
    var question = item.querySelector(".{prefixo}-question");
    question.addEventListener("click", function () {
      var wasActive = item.classList.contains("active");
      items.forEach(function (other) {
        other.classList.remove("active");
      });
      if (!wasActive) item.classList.add("active");
    });
  });
})();
```

It always closes all of them before deciding whether to open the clicked one — that is what guarantees there are never two
items open at the same time, even clicking in quick succession.
