# Project Slug and Indexing Rule

## Objective

Define how to name the folder of a new project in `projects/<slug>/` and ensure that
paid-traffic (CPC) pages are never indexed by Google, while organic pages stay
indexable normally.

---

## 1. Defining the slug — always ask before creating the folder

- Before creating a new project (first file written in `projects/<slug>/`),
  ask the user what the **production URL** for that page is — the URL used in
  another project/site (the landing may already be published elsewhere, or it
  will be published there in the future).
- Never invent or derive the slug from the Figma file name, the section name,
  or your own assumption (`rules/core.md`: "when a decision is not defined,
  never invent"). The folder name is exactly that production URL — only the
  path/slug, in kebab-case, without protocol or domain.
- Example: production URL `.../emagrecimento-e-metabolismo-c-cpc` → the generated folder is
  `projects/emagrecimento-e-metabolismo-c-cpc/`.
- Applies both to the manual flow (`/analyze-figma` → `/build-lp`) and to the
  automatic pipeline (`/full-build` → skill `figma-to-html`) — the slug is asked before the
  first `Write` inside `projects/`.

## 2. Required suffix — `-cpc`, `-org` or `-obrigada`

- Every slug must end in `-cpc` (paid-traffic version), `-org` (organic
  version) or `-obrigada` (thank-you page, shown after a form submission). Do not create
  a project with a slug without one of these three suffixes.
- If the user provides the URL without making clear which one it is, ask
  explicitly before creating the folder — do not assume.
- `-cpc`: page made for a paid-traffic campaign. Must NOT be indexed by
  Google.
- `-org`: organic page. Must stay indexable normally.
- `-obrigada`: thank-you page of another landing page (the page the visitor is sent to
  after the form). It is not a traffic version, so it takes neither `-cpc` nor `-org`
  — the slug is the production URL as it is (e.g. `<landing>-obrigada`). Must NOT be
  indexed by Google.

## 3. `noindex` required in a `-cpc` or `-obrigada` project

- Every `index.html` of a project whose slug ends in `-cpc` or `-obrigada` MUST contain,
  in the `<head>`:

  ```html
  <meta name="robots" content="noindex" />
  ```

- An `-org` project must NOT contain this tag — an organic page needs to be indexable.
- The `post-tool-use.mjs` hook warns (does not block) when `index.html` is
  written/edited and this rule does not match the slug suffix.
- Part of the `rules/validation.md` checklist before considering the page
  finished.

## 4. Scope — projects are not referenced by the general repository

- Pages in `projects/<slug>/` are ephemeral — they will be deleted from `projects/` in the
  future.
- Never add a link, reference, index entry or mention of a specific
  `projects/<slug>/` in general-scope files of the repository (`README.md`, `CLAUDE.md`,
  `docs/*.md`, or anywhere outside the project's own folder).
- Each `projects/<slug>/` must be self-contained: it does not depend on, nor is it cited by,
  anything outside it (`rules/core.md`, Scope section).

## 5. Automatic validation

- `pre-tool-use.mjs` blocks the creation of a new project (folder not yet existing
  on disk) if the slug does not end in `-cpc`, `-org` or `-obrigada`.
- `post-tool-use.mjs` warns if the `index.html` of a `-cpc` or `-obrigada` project lacks
  `noindex`, or if the `index.html` of an `-org` project has `noindex` improperly.
- These automatic validations do not replace asking the user for the URL — they are a
  safety net for when the slug was already defined wrong.
