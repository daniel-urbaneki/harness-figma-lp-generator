#!/usr/bin/env node
// PostToolUse hook — rule lint on .html/.css/asset written inside projects/.
// Runs AFTER the tool — it cannot undo, only warn (it injects additionalContext
// for the model to see and decide to fix in the same response).
//
// It also warns if a raster (.png/.jpg/.jpeg) is saved into assets/images/ — rules/assets.md
// section 5 requires AVIF for every non-SVG asset (the original file may only stay in
// .audit/assets-original/, never alongside the final deliverable).

import { readFileSync, existsSync } from "node:fs";

function done(warnings, filePath) {
  if (warnings.length) {
    process.stdout.write(
      JSON.stringify({
        systemMessage: `post-tool-use: ${warnings.length} rule(s) possibly violated in ${filePath}`,
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: `[hook post-tool-use — ${filePath}]\n- ${warnings.join("\n- ")}`,
        },
      }),
    );
  }
  process.exit(0);
}

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0);
}

const toolName = input.tool_name;
if (toolName !== "Write" && toolName !== "Edit") process.exit(0);

const filePath =
  (input.tool_input && input.tool_input.file_path) ||
  (input.tool_response && input.tool_response.filePath) ||
  "";
const norm = filePath.replace(/\\/g, "/");

if (!/\/projects\//.test(norm)) process.exit(0);

const rasterInAssetsMatch = norm.match(/\/projects\/[^/]+\/assets\/images\/.*\.(png|jpe?g)$/i);
if (rasterInAssetsMatch) {
  const fileName = norm.split("/").pop();
  done(
    [
      `Raster asset "${fileName}" saved into assets/images/ with extension ${rasterInAssetsMatch[1].toLowerCase()} — rules/assets.md section 5 requires converting every non-SVG raster to .avif (scripts/convert-to-avif.mjs) before delivering. The original may only stay in .audit/assets-original/, never alongside the final deliverable in assets/images/.`,
    ],
    filePath,
  );
}

if (!/\.(html?|css)$/i.test(norm)) process.exit(0);
if (!filePath || !existsSync(filePath)) process.exit(0);

let content;
try {
  content = readFileSync(filePath, "utf8");
} catch {
  process.exit(0);
}

const warnings = [];

if (/\.html?$/i.test(norm)) {
  if (/loading\s*=\s*["']lazy["']/i.test(content)) {
    warnings.push(
      'loading="lazy" found — rules/media.md section 1 forbids it (breaks automated screenshot/validation, naturalWidth:0).',
    );
  }
  const entityRe = /&(?!lt;|gt;|amp;)[a-zA-Z]+;|&(?!lt;|gt;|amp;)#\d+;/;
  if (entityRe.test(content)) {
    warnings.push(
      "HTML entity for a printable character found — rules/html-css-js.md section 1 requires pure UTF-8 (only &lt;/&gt;/&amp; allowed).",
    );
  }

  const imgTagRe = /<img\b[^>]*>/gi;
  let imgMatch;
  let imgMissingAlt = 0;
  let imgMissingSize = 0;
  while ((imgMatch = imgTagRe.exec(content))) {
    const tag = imgMatch[0];
    if (!/\balt\s*=/i.test(tag)) imgMissingAlt++;
    if (!/\bwidth\s*=/i.test(tag) || !/\bheight\s*=/i.test(tag)) imgMissingSize++;
  }
  if (imgMissingAlt > 0) {
    warnings.push(
      `${imgMissingAlt} <img> without an alt attribute — rules/html-css-js.md section 6 requires alt always present (descriptive if informative, alt="" if decorative).`,
    );
  }
  if (imgMissingSize > 0) {
    warnings.push(
      `${imgMissingSize} <img> without explicit width/height — rules/media.md section 1 requires the real dimension of the asset in both attributes (display size adjustment goes through CSS).`,
    );
  }

  const h1Count = (content.match(/<h1\b/gi) || []).length;
  if (h1Count > 1) {
    warnings.push(
      `${h1Count} <h1> found in the same document — rules/html-css-js.md section 1 requires a single <h1> per page.`,
    );
  }
}

if (/\.css$/i.test(norm)) {
  if (/\bclamp\(/i.test(content)) {
    warnings.push(
      "clamp() found — rules/css-sizing.md bans it everywhere, including fluid breakpoint interpolation. Use fixed px/% per breakpoint via @media instead.",
    );
  }
  if (/\b(?:min|max)\(/i.test(content)) {
    warnings.push(
      "min()/max() CSS function found — rules/css-sizing.md bans them (the max-width/min-width PROPERTIES are still allowed). Use a fixed px/% value instead.",
    );
  }
  if (/\d(?:\.\d+)?(?:vw|vh)\b/i.test(content)) {
    warnings.push(
      "vw/vh unit found — rules/css-sizing.md bans it everywhere. Use px, % or rem instead.",
    );
  }
  if (/\baspect-ratio\s*:/i.test(content)) {
    warnings.push(
      "aspect-ratio property found — rules/css-sizing.md bans it (rules/media.md section 1: size images via width/height attributes instead). Ask the user before keeping it, only in a genuine extreme case.",
    );
  }
  if (/\bmargin(-(?:left|right|inline))?\s*:\s*[^;]*\bauto\b/i.test(content)) {
    warnings.push(
      "margin: auto (or margin-left/margin-right/margin-inline: auto) found — rules/css-sizing.md bans it. Center via flex/grid on the parent container instead.",
    );
  }
  const decimalMatches = content.match(/\b\d+\.\d+(?:px|%)/g) || [];
  if (decimalMatches.length > 0) {
    warnings.push(
      `${decimalMatches.length} decimal px/% value(s) found (e.g. "${decimalMatches[0]}") — rules/css-sizing.md requires rounding to a clean value unless the exact decimal is genuinely required for Figma fidelity (aspect-ratio padding-hack, crop offsets). Review before delivering.`,
    );
  }
}

const indexSlugMatch = norm.match(/\/projects\/([^/]+)\/index\.html$/i);
if (indexSlugMatch) {
  const slug = indexSlugMatch[1];
  const hasNoindex =
    /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["'][^>]*>/i.test(content);
  if (/-(cpc|obrigada)$/.test(slug) && !hasNoindex) {
    warnings.push(
      `Slug "${slug}" ends in "-cpc" (paid traffic) or "-obrigada" (thank-you page) but index.html has no <meta name="robots" content="noindex"> — rules/project-naming.md section 3 requires mandatory noindex on a CPC or thank-you page.`,
    );
  }
  if (/-org$/.test(slug) && hasNoindex) {
    warnings.push(
      `Slug "${slug}" ends in "-org" (organic) but index.html has noindex — rules/project-naming.md section 3 requires an organic page to remain indexable (without noindex).`,
    );
  }
}

if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(content)) {
  warnings.push(
    "Reference to fonts.googleapis.com/fonts.gstatic.com found — rules/assets.md section 13 requires a locally vendored font, never a CDN.",
  );
}

if (/cdn\.jsdelivr\.net\/npm\/swiper|unpkg\.com\/swiper/i.test(content)) {
  warnings.push(
    "Swiper CDN found — rules/html-css-js.md section 7.1 requires vendoring into assets/vendor/swiper/, never a CDN.",
  );
}

if (
  /lite-yt-embed(\.min)?\.(css|js)["'][^>]*(cdn|unpkg|jsdelivr)/i.test(content) ||
  /(cdn|unpkg|jsdelivr)[^"'>]*lite-yt-embed/i.test(content)
) {
  warnings.push(
    "lite-youtube-embed CDN found — rules/media.md section 5 requires vendoring into assets/vendor/lite-youtube-embed/, never a CDN.",
  );
}

done(warnings, filePath);
