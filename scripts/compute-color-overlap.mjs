import { pathToFileURL } from "node:url";
import { loadPng } from "./lib/load-png.mjs";

const MATCH_THRESHOLD = 30; // Euclidean RGB distance threshold (not perceptual deltaE)
const QUANT_STEP = 32; // bucket size per channel
const QUANT_MAX = 256 - QUANT_STEP; // 224 — last bucket center
const SAMPLE_STRIDE = 4; // take every Nth pixel on each axis

/**
 * @typedef {[number, number, number]} Rgb
 */

/**
 * @param {Rgb} a
 * @param {Rgb} b
 */
export function rgbDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Fraction of paletteA colors that have a near-match in paletteB.
 * NOT symmetric: computeColorOverlap(A,B) !== computeColorOverlap(B,A) in general.
 * Semantically this is "recall of A in B" — call as computeColorOverlap(expected, actual).
 */
/**
 * @param {Rgb[]} paletteA
 * @param {Rgb[]} paletteB
 */
export function computeColorOverlap(paletteA, paletteB) {
  if (paletteA.length === 0 || paletteB.length === 0) return 0;
  let matched = 0;
  for (const colorA of paletteA) {
    const hasMatch = paletteB.some(
      (/** @type {Rgb} */ colorB) => rgbDistance(colorA, colorB) < MATCH_THRESHOLD,
    );
    if (hasMatch) matched++;
  }
  return matched / paletteA.length;
}

/**
 * @param {number} c
 */
function quantize(c) {
  return Math.min(Math.floor(c / QUANT_STEP) * QUANT_STEP, QUANT_MAX);
}

/**
 * @param {string} pngPath
 * @param {number} [k]
 */
export async function extractDominantColors(pngPath, k = 8) {
  const png = await loadPng(pngPath);
  const { data, width, height } = png;
  const counts = new Map();
  for (let y = 0; y < height; y += SAMPLE_STRIDE) {
    for (let x = 0; x < width; x += SAMPLE_STRIDE) {
      const idx = (width * y + x) << 2;
      const alpha = data[idx + 3];
      if (alpha < 128) continue;
      const r = quantize(data[idx]);
      const g = quantize(data[idx + 1]);
      const b = quantize(data[idx + 2]);
      const key = `${r},${g},${b}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, k);
  return sorted.map(([key]) => key.split(",").map(Number));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , a, b] = process.argv;
  if (!a || !b) {
    console.error("usage: node compute-color-overlap.mjs <expected.png> <actual.png>");
    process.exit(1);
  }
  try {
    const [pa, pb] = await Promise.all([extractDominantColors(a), extractDominantColors(b)]);
    console.log(JSON.stringify({ colorOverlap: computeColorOverlap(pa, pb) }));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
