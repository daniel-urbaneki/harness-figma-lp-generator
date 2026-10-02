---
description: Generate the whole landing page from the Figma links (root frame desktop 1920 + mobile 430), via a multi-agent pipeline (dual desktop/mobile extraction, parallel per-section build, visual evaluation, automatic correction up to 5x).
---

Invoke the `figma-to-html` skill.

This fires the full pipeline (not the manual section-by-section flow of `/analyze-figma`+`/build-lp`+`/validate-lp`) — several sections in parallel (cap 4), automatic desktop+mobile score, correction loop.

Confirm the landing page's **two Figma links** with the user before firing, if they did not pass both (`.claude/rules/figma.md`, "Selection links"):

1. link to the **desktop root frame** (URL with the `node-id` at 1920);
2. link to the **mobile root frame** (URL with the `node-id` at 430).

Never infer the mobile root frame on your own — the "~430 sibling frame on the same page" heuristic is only a fallback, and the node it picks has to be confirmed with the user.

If the project (`projects/<slug>/`) does not exist yet, also ask for the page's production URL before firing — the folder slug is exactly that URL, ending in `-cpc` or `-org` (`.claude/rules/project-naming.md`).
