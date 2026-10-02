# Figma → Static Landing Pages

Repository of **tooling and rules** to turn Figma designs into static landing pages
(HTML, CSS and vanilla JavaScript), with high visual fidelity and no invented content.

It is not a framework nor a library: it is the set of **rules, procedures and automatic checks**
that Claude Code follows when building each LP. Figma is the visual source of truth;
the repository exists to keep the implementation from drifting away from it.

---

## Contents

- [How it works](#how-it-works)
- [Installation](#installation)
- [Local Figma MCP (required)](#local-figma-mcp-required)
- [The two workflows](#the-two-workflows)
- [Commands](#commands)
- [Repository structure](#repository-structure)
- [Rules (`.claude/rules/`)](#rules-clauderules)
- [Skills (`.claude/skills/`)](#skills-claudeskills)
- [Agents (`.claude/agents/`)](#agents-claudeagents)
- [Required decisions and standards](#required-decisions-and-standards)
- [Automatic guardrails (hooks)](#automatic-guardrails-hooks)
- [Tooling and quality](#tooling-and-quality)
- [Current state and known limitations](#current-state-and-known-limitations)

---

## How it works

Every implementation follows the same workflow, without skipping steps:

```text
Figma → Analysis → Planning → Assets → HTML → CSS → JavaScript
      → Responsiveness → Validation → Correction → Delivery
```

Each landing page is independent and lives in `projects/<slug>/`. The folder name **is the
production URL** of the page, and always ends in `-cpc` (paid traffic) or `-org` (organic) — see
[Required decisions and standards](#required-decisions-and-standards).

Three principles hold up the rest:

1. **Figma is the source of truth.** Color, spacing, typography and dimension come from the design,
   not from visual estimation. When the data exists in Figma, estimating is a rule violation.
2. **Never invent, never approximate.** No element, asset or behavior that is not in the
   design (or was not requested). An original asset is never replaced by an icon from a library,
   an emoji or a CSS recreation.
3. **Ambiguity becomes a question, not an assumption.** Hover, transition, carousel, missing
   content — all of that stops the work and
   goes back to the user.

### Priority order in case of conflict

1. Explicit user instruction in the current task
2. Figma (visual source of truth)
3. `CLAUDE.md`
4. `.claude/rules/*`

---

## Installation

**Prerequisites:** Node.js 20+ (CI runs on 22) and the **Figma desktop** app with the Dev Mode MCP
server active (see [Local Figma MCP](#local-figma-mcp-required) — it is a real prerequisite,
not optional).

```bash
npm ci
cp .mcp.json.example .mcp.json
```

`.mcp.json` and `.env` are in `.gitignore` (they hold credentials) and are **blocked for writing**
by the security hook — they must be edited manually by the user.

---

## Local Figma MCP (required)

Every Figma read goes through the **local Dev Mode MCP server**, which the Figma desktop app serves
at `http://127.0.0.1:3845/mcp`. That is the server configured in `.mcp.json`, and it is the one that
must keep being used.

**Do not use the remote server** (`https://mcp.figma.com/mcp`). It authenticates via OAuth with the
browser account, which may not be the account that owns the file — in that case it answers 403 on a
file you see normally in the app, and the error looks like a bug when it is permission.

### Requirements

| Requirement           | Detail                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Desktop** Figma app | Installed and **open during the whole build** — if it closes midway, the server goes down with it                                     |
| **Active tab**        | The **selected** tab in the app must be a **design or FigJam** file — see "Active tab" below                                          |
| Logged-in account     | Must be the account that has access to the LP file                                                                                    |
| Seat and plan         | Dev or Full on a **paid** plan (Professional, Organization or Enterprise). On Starter the option does not even show up in Preferences |
| Server enabled        | Toggle in Preferences (see below)                                                                                                     |

### Active tab — the no. 1 cause of a misleading "timeout"

The server only responds while the **foreground tab** of Figma Desktop is a design or FigJam file.
It is not enough for the file to be open in a secondary tab.

If the user switches to a settings tab, a community tab, or to a Figma Make file,
every call starts failing with:

```
The MCP server is only available if your active tab is a design or FigJam file.
```

**Why this is misleading:** port 3845 keeps responding (`curl` returns `400`, and
`Get-NetTCPConnection` shows the process listening), so everything looks healthy. The error only
shows up in the tool call — and background agents tend to read it as a timeout or "session expired"
and keep retrying for minutes. In a real run of this repo that burned ~3 hours across
two sections before the cause was identified.

**Quick diagnosis:** if `get_metadata` works but `get_design_context` fails repeatedly,
suspect the active tab before suspecting load or network. And if the `mcp__figma__*` tools
disappear from the session, `/mcp` usually shows the message above explicitly.

### How to check whether it is active

Three ways, from the fastest to the most conclusive.

**1. Through Claude Code** — run `/mcp`. The `figma` server must appear connected.

**2. Through the port** — the server listens on `127.0.0.1:3845`:

```powershell
# PowerShell
Get-NetTCPConnection -State Listen -LocalPort 3845 -ErrorAction SilentlyContinue
```

```bash
# Git Bash — "000" means nothing is listening
curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 http://127.0.0.1:3845/mcp
```

**3. Through the handshake** — proves it really is the Figma server, and not something else on the port:

```bash
curl -s --max-time 8 -X POST http://127.0.0.1:3845/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}'
```

A response containing `"serverInfo":{"name":"Figma Dev Mode MCP Server"}` = active.

### How to enable it

1. Open the **Figma desktop app** (not Figma in the browser).
2. Check, in the account menu, that you are logged into the account that has the LP file.
3. Open the landing page file.
4. Menu **Figma → Preferences** → check **"Enable local MCP server"** (it also shows up as
   "Dev Mode MCP server").
5. Confirm the notification that the server is running at `127.0.0.1:3845`.
6. Make sure there is a `.mcp.json` at the root pointing to that address — if there is not,
   `cp .mcp.json.example .mcp.json`.
7. **Restart the Claude Code session** — MCP is only loaded at session boot.

### If the option does not appear in Preferences

In order of likelihood:

1. **Account without a Dev/Full seat on a paid plan.** This is the most common cause. Check which
   account is logged into the app — not the browser one, the desktop one.
2. **You are logged into the wrong account.** Log out and log into the account that has the file.
3. **Outdated app.** Update Figma desktop.

Until it is resolved, do not proceed with estimated data: `rules/core.md` and `rules/figma.md`
forbid inventing a visual value that Figma has exactly.

### Tools exposed by the local server

| Tool                               | Use in the project                                           |
| ---------------------------------- | ------------------------------------------------------------ |
| `get_metadata`                     | Hierarchical map; split of the landing into sections         |
| `get_design_context`               | Tokens, structure and asset URLs of a section                |
| `get_screenshot`                   | Reference image, compared against the HTML during validation |
| `get_variable_defs`                | Design variables, when the file uses them                    |
| `get_figjam`, `get_motion_context` | Not used by this project                                     |

### Alternative path — REST API

`scripts/figma-rest.mjs` reads Figma through the REST API instead of MCP. **It is not the default
path** — it only serves when the local MCP is not available:

- Figma app closed, or logged into an account without access to the file;
- headless/CI execution, where there is no desktop app;
- account without a Dev/Full seat on a paid plan.

It requires a personal access token in `.env` (see `.env.example`). Only use it with explicit
authorization from the user — the default is still the local MCP.

---

## The two workflows

The project offers two paths to the same result. The difference is the degree of automation and of
human oversight.

### 1. Manual flow — section by section, with you in the loop

Suited for: isolated sections, one-off adjustments, when you want to review each step.

```text
/analyze-figma  →  /extract-assets  →  /build-lp  →  /validate-lp  →  /fix-lp
```

Each command invokes a skill that runs directly in the conversation, shows the result and waits for
your confirmation at the ambiguous points.

### 2. Automated flow — whole page, multi-agent

Suited for: building the complete landing in one go.

```text
/full-build
```

Triggers the `figma-to-html` pipeline, orchestrating 4 specialized agents:

```text
1. Splits the root frame into sections (desktop + mobile, matched to each other)
2. For each section, in parallel waves of up to 4:
      figma-analyzer  →  [asks if there is ambiguity]  →  frontend-builder  →  asset-reviewer
                                                                        ↓
                                          visual-reviewer (desktop)  +  visual-reviewer (mobile)
                                                                        ↓
                                              score < 0.90?  →  correction  →  revalidate (up to 5x)
3. Aggregates everything into projects/<slug>/index.html + css/ + js/ + assets/
4. Renders the complete page in the 2 viewports
5. Evaluates the whole page (desktop and mobile)
6. Fixes the sections with the worst score, if necessary
7. Writes the report to .audit/README.md
```

**Fidelity score** — composed of three measured signals, never estimated:

| Signal        | Weight | What it measures                                  |
| ------------- | ------ | ------------------------------------------------- |
| SSIM          | 0.45   | Structural similarity between the two images      |
| Layout IoU    | 0.40   | Overlap of the bounding boxes per `data-figma-id` |
| Color overlap | 0.15   | Share of palette colors with a match              |

Target: **0.90**. Maximum of 5 correction iterations per section, with an early stop when the score
stagnates (gain < 0.01 in two consecutive rounds).

---

## Commands

| Command           | What it does                                                       | Skill invoked       |
| ----------------- | ------------------------------------------------------------------ | ------------------- |
| `/analyze-figma`  | Analyzes hierarchy, tokens, assets and responsiveness of a section | `figma-analysis`    |
| `/extract-assets` | Exports, triages and organizes the section's assets                | `asset-management`  |
| `/build-lp`       | Builds the HTML/CSS/JS of the section or page                      | `html-build`        |
| `/validate-lp`    | Validates against Figma (checklist + visual comparison)            | `visual-validation` |
| `/fix-lp`         | Fixes the differences found during validation                      | `lp-correction`     |
| `/full-build`     | Generates the whole landing via the multi-agent pipeline           | `figma-to-html`     |

---

## Repository structure

```text
.claude/
├── rules/            # rules per domain — the normative source of truth
│   └── references/   # ready canonical artifacts (e.g. page skeleton)
├── skills/           # executable procedures per workflow step
├── agents/           # the 4 roles of the automated pipeline
├── commands/         # shortcuts (/analyze-figma, /full-build, ...)
├── hooks/            # automatic guardrails (block and warn)
└── settings.json     # hook registration

scripts/              # Node tooling (scoring, render, schemas, AVIF conversion)
projects/<slug>/      # the generated landing pages
├── index.html
├── css/  js/  assets/
└── .audit/           # metrics, screenshots and originals — outside the delivery, gitignored

docs/REUSE-AS-BASE.md # how to fork this repo for another target (e.g. WordPress/PHP)
```

### Asset organization inside `projects/<slug>/`

| Folder                 | Content                                                |
| ---------------------- | ------------------------------------------------------ |
| `assets/images/icons/` | Icons (≤64px): chevrons, checks, social icons, play    |
| `assets/images/bgs/`   | Backgrounds, photos, banners, general images           |
| `assets/images/logos/` | Brands, wordmarks, partner logos, seals                |
| `assets/fonts/`        | Vendored fonts (`.woff2`, one file per weight)         |
| `assets/vendor/`       | Vendored third-party libs (Swiper, lite-youtube-embed) |

---

## Rules (`.claude/rules/`)

Ten files, each governing one domain. They are normative: what is here applies to any
implementation, in both flows.

| Rule                    | What it governs                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`core.md`**           | General principles, priority order in conflict, handling of ambiguity, scope per `projects/<slug>/`                                                               |
| **`figma.md`**          | What to analyze before implementing; requirement of the **two selection links** (desktop 1920 + mobile 430); MCP usage; hierarchy fidelity                        |
| **`assets.md`**         | Priority of the original asset; prohibition on fragmenting SVG; **AVIF required** for raster; CSS-first triage; download and verification; naming; vendored fonts |
| **`html-css-js.md`**    | Semantic and accessible HTML; CSS with tokens and scope; minimal JS; performance; IDs; and the **standard components** (7.1 carousel, 7.2 FAQ)                    |
| **`responsive.md`**     | The 7 fixed breakpoints; which ones have a real frame in Figma; **desktop × mobile comparison required before building** (axis inversion, grouping)               |
| **`media.md`**          | Image (real `width`/`height`, never `loading="lazy"`), video, audio and YouTube embed via `lite-youtube-embed`                                                    |
| **`validation.md`**     | Required checklist before delivering; how to record and fix differences; when to stop and ask                                                                     |
| **`project-naming.md`** | Slug = production URL; `-cpc`/`-org` suffix; `noindex` required on CPC; projects are not referenced by the general repository                                     |
| **`tooling.md`**        | `npm run verify` required when touching `scripts/` and `.claude/hooks/`; a vendored asset never goes through lint/format                                          |

### Breakpoints

Fixed project standard, built from the largest to the smallest:

`1920` → `1515` → `1366` → `1025` → `890` → `550` → `390`

Figma normally draws only **two** sizes per section: desktop **1920** and mobile **430**.
So only `1920` and `390` (approximation of the 430) have a real frame; the five intermediate ones are
interpolated with `clamp()`/`%`/flex. Interpolation is always marked in a CSS comment — it never
passes as real Figma fidelity.

---

## Skills (`.claude/skills/`)

Skills are the **executable procedures**. Six run in the manual flow; one orchestrates the pipeline.

| Skill               | Workflow step     | What it does                                                                                    |
| ------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| `figma-analysis`    | Analysis          | Extracts hierarchy, typography, colors, spacing, candidate assets; compares desktop × mobile    |
| `asset-management`  | Assets            | CSS-first triage, categorization, download, AVIF conversion, verification of a valid file       |
| `html-build`        | HTML / CSS / JS   | Writes the semantic structure, scoped CSS and JS (only if there is real behavior)               |
| `responsive-layout` | Responsiveness    | Applies the 7 breakpoints; checks whether each desktop × mobile difference was implemented      |
| `visual-validation` | Validation        | Runs the checklist and the visual comparison (side-by-side screenshot, optionally with a score) |
| `lp-correction`     | Correction        | Applies the fixes for the differences found and revalidates                                     |
| `figma-to-html`     | Complete pipeline | Orchestrates the 4 agents, aggregates the result, evaluates and runs the correction loop        |

---

## Agents (`.claude/agents/`)

Used only by the automated pipeline. Each one has a strict scope and returns JSON validated
against a Zod schema (`scripts/schemas.mjs`) before moving on to the next.

| Agent              | Role                | Does                                                                                         | Never does                                 |
| ------------------ | ------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `figma-analyzer`   | Extractor           | Extracts the section on both sides → tokens, assets, layout, screenshots, layout differences | Write HTML, download an asset              |
| `frontend-builder` | Builder + Corrector | Builds the section's HTML/CSS/JS; applies corrections guided by the evaluator                | Call the Figma MCP                         |
| `asset-reviewer`   | Asset processor     | Downloads, categorizes, converts to AVIF and integrates the assets into the HTML/CSS         | Call the Figma MCP directly                |
| `visual-reviewer`  | Evaluator           | Computes the composite score per breakpoint and lists the issues found                       | Suggest a fix (only describes the problem) |

The agents **do not talk to the user** — when an ambiguous decision comes up, they flag it in the
JSON and it is the orchestrator that asks.

---

## Required decisions and standards

Accumulated standards that are not re-decided on each LP.

### Naming and indexing

- The folder name is the page's **production URL**, always asked before creating the project.
- Required suffix: `-cpc` (paid traffic) or `-org` (organic).
- A `-cpc` page **requires** `<meta name="robots" content="noindex">`; an `-org` page **must not** have it.
- Projects in `projects/` are ephemeral and are never referenced by files of the general repository.

### Images

- Every raster (non-SVG) is delivered in **AVIF**. SVG stays SVG.
- The Figma REST API does not export AVIF; the conversion uses `scripts/convert-to-avif.mjs` (`sharp`).
- The original file is preserved in `.audit/assets-original/`, outside the final delivery.
- `width`/`height` always with the **real** dimension of the file; display adjustments go through CSS.
- Real descriptive `alt` on an informative image; `alt=""` on a decorative one. Never `loading="lazy"`.

### Components

| Component    | Standard                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Carousel** | Detecting is not deciding: **always ask** whether to implement it as Swiper or a static list. Swiper 11 vendored, never CDN |
| **FAQ**      | `div`-based accordion, **single-open** (opening one closes the others). Chevron icon (rotates 180°) or `+`/`−` (pure CSS)   |
| **YouTube**  | Always vendored `lite-youtube-embed`; never a raw `<iframe>`; never invent a video ID                                       |

### Semantics

- Standard HTML5 tags only — never invent a custom tag.
- A single `<h1>` per page; `<h2>`/`<h3>`+ without skipping a level. A heading is semantics, not visual weight.
- A list of items uses `<ul>`/`<li>`.

### Responsiveness

Before writing the HTML, the two frames are compared **node by node**. Two differences define the
structure and are not fixable later with CSS alone:

- **Axis inversion** (`row` ↔ `column`) between desktop and mobile.
- **Divergent grouping**: when one side groups children in a sub-frame and the other has them loose,
  the HTML needs a shared wrapper — CSS does not reparent an element. The wrapper is neutralized
  on the loose side with a `gap` identical to the parent's, or with `display: contents`.

---

## Automatic guardrails (hooks)

Two hooks in `.claude/hooks/` apply part of the rules automatically, without depending on memory.

### `pre-tool-use.mjs` — **blocks** before the action

- Writing to `.env` / `.env.local` (secrets).
- Writing to `output/` (old convention), `.git/` or `node_modules/`.
- Creating a new project with a slug outside the `-cpc` / `-org` standard.
- Writing to another `projects/<slug>/` after the session is already working on one (scope guard).
- `npm install` of a package outside the authorized allowlist (`puppeteer`, `ssim.js`, `pngjs`, `zod`, `sharp`).

### `post-tool-use.mjs` — **warns** after the write

Runs on `.html`/`.css`/assets inside `projects/` and flags:

- `loading="lazy"` and HTML entities for printable characters.
- Raster (`.png`/`.jpg`) saved in `assets/images/` without conversion to AVIF.
- `-cpc` without `noindex`, or `-org` with `noindex`.
- Reference to a CDN (Google Fonts, Swiper, lite-youtube-embed) instead of the vendored file.
- `<img>` without `alt` or without `width`/`height`; more than one `<h1>` in the document.

---

## Tooling and quality

`scripts/*.mjs` and `.claude/hooks/*.mjs` have their own verification (ESLint, TypeScript with
`checkJs`, Vitest, Prettier). **It does not apply to `projects/<slug>/`**, whose quality is governed by
`rules/validation.md`.

Two folders stay out of lint/format on purpose, and the exclusion must not be removed: third-party
vendored assets (`projects/**/assets/vendor/**`) and canonical reference artifacts
(`.claude/rules/references/**`). In both cases, reformatting alters a file that must be
reproduced as is.

| Script              | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `npm run verify`    | lint + typecheck + test + format:check (what CI runs) |
| `npm run lint`      | ESLint                                                |
| `npm run typecheck` | TypeScript in `checkJs` mode                          |
| `npm test`          | Vitest                                                |
| `npm run format`    | Prettier (write)                                      |
| `npm run score`     | Computes the composite score from the three signals   |

### Support scripts

| File                          | Purpose                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| `compute-ssim.mjs`            | Structural similarity between two PNGs                                  |
| `compute-layout-iou.mjs`      | IoU of the bounding boxes (via `data-figma-id`)                         |
| `compute-color-overlap.mjs`   | Palette overlap between two images                                      |
| `compute-composite-score.mjs` | Combines the three signals with weights 0.45 / 0.40 / 0.15              |
| `corrector-guard.mjs`         | Decides whether the correction loop continues (target, cap, stagnation) |
| `render-html-screenshot.mjs`  | Screenshot, bounding box extraction and resize (Puppeteer)              |
| `convert-to-avif.mjs`         | Converts raster to AVIF (`sharp`, quality 75)                           |
| `schemas.mjs`                 | Zod schemas that validate the communication between the agents          |

**CI and pre-commit:** `.github/workflows/ci.yml` runs `npm run verify` on every push and PR;
`.husky/pre-commit` runs `lint-staged` (ESLint `--fix` + Prettier on the staged files).

---

## Current state and known limitations

- **No LP built yet.** The `projects/` folder is empty — the whole infrastructure is
  ready, but no landing has been generated in this repository so far.
- **`npm run format:check` fails on 54 files.** Pre-existing divergence since the initial
  commit — all 54 already existed before, including files never edited such as `package.json`.
  `lint`, `typecheck` and `test` pass. Fixing it requires reformatting the entire repository, which
  would produce a large, non-reviewable diff mixed with content changes — decision pending.
  Since CI runs `npm run verify`, **CI is red for this reason** until the decision is made.
- **AVIF depends on local conversion.** The Figma REST API exports only `png`/`jpg`/`svg`/`pdf`;
  the `format=avif` path is provided for in the code for when/if support appears, but today every
  raster goes through `sharp`.
- **Test coverage is minimal** (smoke test only). New logic in `scripts/` should come with a
  Vitest test — recommended, not yet required.

---

## Reuse

This repository is the **vanilla HTML/CSS/JS** target. To create a new target (WordPress/PHP,
another framework), the recorded decision is **fork**, not monorepo nor submodule. The table of what is
core (copy as is) versus what is specific to this target is in
[`docs/REUSE-AS-BASE.md`](docs/REUSE-AS-BASE.md).
