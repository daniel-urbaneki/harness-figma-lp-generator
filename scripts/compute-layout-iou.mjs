import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

/**
 * @typedef {{x: number, y: number, w: number, h: number}} Box
 */

/**
 * @param {Box} b
 * @param {string} which
 */
function validateBox(b, which) {
  if (b.w < 0 || b.h < 0) {
    throw new Error(`iouOfBoxes: invalid ${which} box, negative dimensions w=${b.w} h=${b.h}`);
  }
  if (b.w === 0 || b.h === 0) {
    throw new Error(`iouOfBoxes: invalid ${which} box, zero dimensions w=${b.w} h=${b.h}`);
  }
}

/**
 * @param {Box} a
 * @param {Box} b
 */
export function iouOfBoxes(a, b) {
  validateBox(a, "first");
  validateBox(b, "second");
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const interX1 = Math.max(a.x, b.x);
  const interY1 = Math.max(a.y, b.y);
  const interX2 = Math.min(ax2, bx2);
  const interY2 = Math.min(ay2, by2);
  const interW = Math.max(0, interX2 - interX1);
  const interH = Math.max(0, interY2 - interY1);
  const inter = interW * interH;
  const union = a.w * a.h + b.w * b.h - inter;
  if (union === 0) return 0;
  return inter / union;
}

// Extras in `actual` not in `expected` are intentionally ignored — those are
// an HTML-validity concern, not a layout-fidelity concern. Missing keys, on the
// other hand, count as IoU=0 so the corrector sees coverage failures.
/**
 * @param {Record<string, Box>} expected
 * @param {Record<string, Box>} actual
 */
export function computeLayoutIoU(expected, actual) {
  const expectedKeys = Object.keys(expected);
  if (expectedKeys.length === 0) return 0;
  let sum = 0;
  for (const k of expectedKeys) {
    sum += actual[k] ? iouOfBoxes(expected[k], actual[k]) : 0;
  }
  return sum / expectedKeys.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , expectedPath, actualPath] = process.argv;
  if (!expectedPath || !actualPath) {
    console.error("usage: node compute-layout-iou.mjs <expected.json> <actual.json>");
    process.exit(1);
  }
  try {
    const [expected, actual] = await Promise.all([
      readFile(expectedPath, "utf8").then(JSON.parse),
      readFile(actualPath, "utf8").then(JSON.parse),
    ]);
    console.log(JSON.stringify({ iou: computeLayoutIoU(expected, actual) }));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
