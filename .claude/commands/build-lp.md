---
description: Build the HTML/CSS/JS of a section/page from the analysis and the already extracted assets.
---

Invoke the `html-build` skill.

Prerequisite: `figma-analysis` already ran for this section/page. If it has assets to export and `asset-management` has not run yet, run it first — `html-build` never invents an asset reference.

After the build, run `/validate-lp` before considering the section done.
