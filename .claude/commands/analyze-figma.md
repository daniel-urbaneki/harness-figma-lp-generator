---
description: Analyze a Figma section/frame before implementing (hierarchy, tokens, assets, responsive).
---

Invoke the `figma-analysis` skill.

Ask for the **two Figma links** before continuing, if the user did not pass both in this message (`.claude/rules/figma.md`, "Selection links"):

1. **desktop** selection link (URL with the `node-id` of the section/frame at 1920);
2. **mobile** selection link (URL with the `node-id` of the corresponding section/frame at 430).

Never guess which section to analyze, and never infer the mobile frame on your own — the "~430 sibling frame on the same page" heuristic only comes in if the user says they do not have the mobile link, and in that case the chosen node has to be confirmed with them.

If the project (`projects/<slug>/`) does not exist yet, ask for the page's production URL before proceeding — the folder slug is exactly that URL, ending in `-cpc` or `-org` (`.claude/rules/project-naming.md`).
