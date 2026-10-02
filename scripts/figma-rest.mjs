// Figma REST API CLI — ALTERNATIVE path for reading Figma.
//
// The pipeline (figma-to-html skill) reads Figma through the local Dev Mode MCP server
// (http://127.0.0.1:3845/mcp), not through here. This script exists for the cases where that
// server does not work:
//   - Figma app closed, or logged into an account without access to the file;
//   - headless/CI run, where there is no desktop app;
//   - account without a Dev/Full seat on a paid plan (the local MCP requires it).
// Requires FIGMA_TOKEN (or FIGMA_PAT/PAT) in the .env — see .env.example.
//
// Subcommands:
//   parse-url  <url>                                  → fileKey + nodeId from the selection URL
//   sections   --file K --node ID                     → children that count as a section (split)
//   extract    --file K --node ID --out F.json        → normalized section (ViewportData)
//   screenshot --file K --node ID --out F.png         → reference PNG of the section
//   assets     --file K --ids A,B --format svg --outdir D → exports and downloads assets
//
// Every success output is single-line JSON on stdout. `extract` writes the large payload to a
// file and prints only a summary — the raw JSON of a section does not fit in an agent's context.

import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { figmaGet, fetchBinary, parseFigmaUrl } from "./lib/figma-http.mjs";
import { normalizeSection, listSections } from "./lib/figma-normalize.mjs";

const IMAGE_BATCH_SIZE = 20; // the API accepts several ids per call — 1 request per batch

/**
 * @param {string[]} argv
 * @returns {Record<string, string>}
 */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

/**
 * @param {Record<string, string>} args
 * @param {string} name
 */
function required(args, name) {
  const value = args[name];
  if (!value) throw new Error(`missing --${name}`);
  return value;
}

/** node-id comes with "-" in the Figma URL and with ":" in the REST API — always normalize. @param {string} id */
function normalizeNodeId(id) {
  return id.replace(/-/g, ":");
}

/**
 * Fetches a node and returns its `document`.
 * @param {string} fileKey
 * @param {string} nodeId
 * @param {number} [depth]
 */
async function fetchNode(fileKey, nodeId, depth) {
  const id = normalizeNodeId(nodeId);
  const data = await figmaGet(`/v1/files/${fileKey}/nodes`, { ids: id, depth });
  const entry = data?.nodes?.[id];
  if (!entry?.document) {
    throw new Error(
      `node ${id} did not come in the response for file ${fileKey}. Check the node-id (it must be the one from the URL, with "-" turned into ":") and whether you have access to this file.`,
    );
  }
  return entry.document;
}

/**
 * Export URLs for a batch of nodes.
 * @param {string} fileKey
 * @param {string[]} nodeIds
 * @param {string} format
 * @param {number} [scale]
 * @returns {Promise<Record<string, string | null>>}
 */
async function fetchImageUrls(fileKey, nodeIds, format, scale) {
  /** @type {Record<string, string | null>} */
  const merged = {};
  for (let i = 0; i < nodeIds.length; i += IMAGE_BATCH_SIZE) {
    const batch = nodeIds.slice(i, i + IMAGE_BATCH_SIZE);
    const data = await figmaGet(`/v1/images/${fileKey}`, {
      ids: batch.join(","),
      format,
      scale: format === "svg" ? undefined : scale,
    });
    if (data?.err) throw new Error(`export failed: ${data.err}`);
    Object.assign(merged, data?.images || {});
  }
  return merged;
}

/**
 * @param {string} url
 * @param {string} destPath
 * @returns {Promise<number>} bytes written
 */
async function downloadTo(url, destPath) {
  const buffer = await fetchBinary(url);
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, buffer);
  // A Figma export fails silently (rules/assets.md section 4) — an empty file is a real error.
  const { size } = statSync(destPath);
  if (size === 0) throw new Error(`downloaded file is empty: ${destPath}`);
  return size;
}

/** @param {Record<string, string>} args */
async function cmdSections(args) {
  const fileKey = required(args, "file");
  const document = await fetchNode(fileKey, required(args, "node"), 2);
  const box = document.absoluteBoundingBox;
  return {
    rootNodeId: document.id,
    rootName: document.name,
    rootWidth: box ? Math.round(box.width) : null,
    rootHeight: box ? Math.round(box.height) : null,
    sections: listSections(document, args.minHeight ? Number(args.minHeight) : undefined),
  };
}

/** @param {Record<string, string>} args */
async function cmdExtract(args) {
  const fileKey = required(args, "file");
  const outPath = required(args, "out");
  const document = await fetchNode(fileKey, required(args, "node"));
  const normalized = normalizeSection(document);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(normalized, null, 2), "utf8");

  // Summary — the whole payload stays in the file, not on stdout.
  return {
    out: outPath,
    bytes: statSync(outPath).size,
    nodeId: normalized.nodeId,
    name: document.name,
    figmaBbox: normalized.figmaBbox,
    colorCount: Object.keys(normalized.tokens.colors).length,
    fonts: normalized.tokens.fonts.map((/** @type {any} */ f) => `${f.family} ${f.weights}`),
    assetCount: normalized.assets.length,
    warnings: normalized.warnings,
  };
}

/** @param {Record<string, string>} args */
async function cmdScreenshot(args) {
  const fileKey = required(args, "file");
  const nodeId = normalizeNodeId(required(args, "node"));
  const outPath = required(args, "out");
  const scale = args.scale ? Number(args.scale) : 1;

  const urls = await fetchImageUrls(fileKey, [nodeId], "png", scale);
  const url = urls[nodeId];
  if (!url) throw new Error(`Figma returned no image for node ${nodeId}`);
  return { out: outPath, bytes: await downloadTo(url, outPath), scale };
}

/** @param {Record<string, string>} args */
async function cmdAssets(args) {
  const fileKey = required(args, "file");
  const outDir = required(args, "outdir");
  const format = args.format || "svg";
  const scale = args.scale ? Number(args.scale) : 2;
  const ids = required(args, "ids").split(",").map(normalizeNodeId);

  const urls = await fetchImageUrls(fileKey, ids, format, scale);

  /** @type {any[]} */
  const files = [];
  /** @type {string[]} */
  const failed = [];
  for (const id of ids) {
    const url = urls[id];
    if (!url) {
      failed.push(id);
      continue;
    }
    const fileName = `${id.replace(/:/g, "-")}${extname(`.${format}`)}`;
    const destPath = join(outDir, fileName);
    try {
      files.push({ nodeId: id, path: destPath, bytes: await downloadTo(url, destPath), format });
    } catch (e) {
      failed.push(`${id} (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  return { files, failed };
}

/** @param {Record<string, string>} args */
function cmdParseUrl(args) {
  const url = args.url || args._;
  if (!url) throw new Error("missing --url");
  return parseFigmaUrl(url);
}

const USAGE = `usage:
  node scripts/figma-rest.mjs parse-url  --url <figma url>
  node scripts/figma-rest.mjs sections   --file <key> --node <id> [--minHeight 200]
  node scripts/figma-rest.mjs extract    --file <key> --node <id> --out <file.json>
  node scripts/figma-rest.mjs screenshot --file <key> --node <id> --out <file.png> [--scale 1]
  node scripts/figma-rest.mjs assets     --file <key> --ids <a,b> --outdir <dir> [--format svg|png] [--scale 2]`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);
  if (!args.url && rest[0] && !rest[0].startsWith("--")) args._ = rest[0];

  /** @type {Record<string, (a: Record<string, string>) => any>} */
  const commands = {
    "parse-url": cmdParseUrl,
    sections: cmdSections,
    extract: cmdExtract,
    screenshot: cmdScreenshot,
    assets: cmdAssets,
  };

  const handler = commands[command];
  if (!handler) {
    console.error(USAGE);
    process.exit(1);
  }

  Promise.resolve(handler(args))
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    });
}
