import { pathToFileURL } from "node:url";

/**
 * Weighted composite fidelity score.
 * Adjust the weights here if calibration calls for it (see rules/validation.md).
 */
export const WEIGHTS = {
  ssim: 0.45,
  layoutIoU: 0.4,
  colorOverlap: 0.15,
};

/**
 * @param {string} name
 * @param {number} value
 */
function assertInRange(name, value) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
    throw new Error(`combine: signal "${name}" out of range (expected 0..1, got ${value})`);
  }
}

/**
 * @param {{ssim: number, layoutIoU: number, colorOverlap: number}} signals
 * @param {typeof WEIGHTS} [weights]
 */
export function combine(signals, weights = WEIGHTS) {
  assertInRange("ssim", signals.ssim);
  assertInRange("layoutIoU", signals.layoutIoU);
  assertInRange("colorOverlap", signals.colorOverlap);
  return (
    signals.ssim * weights.ssim +
    signals.layoutIoU * weights.layoutIoU +
    signals.colorOverlap * weights.colorOverlap
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const raw = process.argv[2];
  if (!raw) {
    console.error(
      'usage: node compute-composite-score.mjs \'{"ssim":..,"layoutIoU":..,"colorOverlap":..}\'',
    );
    process.exit(1);
  }
  try {
    const signals = JSON.parse(raw);
    console.log(JSON.stringify({ score: combine(signals) }));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
