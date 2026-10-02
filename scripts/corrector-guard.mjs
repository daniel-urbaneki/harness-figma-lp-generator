import { pathToFileURL } from "node:url";

const MIN_IMPROVEMENT = 0.01;

/**
 * @param {{history: number[], threshold: number, maxIter: number}} params
 */
export function shouldContinue({ history, threshold, maxIter }) {
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error("shouldContinue: history must be a non-empty array");
  }
  const last = history[history.length - 1];
  if (last >= threshold) return { continue: false, reason: "threshold-met" };
  if (history.length - 1 >= maxIter) return { continue: false, reason: "max-iter" };
  if (history.length >= 4) {
    const d1 = history[history.length - 1] - history[history.length - 2];
    const d2 = history[history.length - 2] - history[history.length - 3];
    if (d1 < MIN_IMPROVEMENT && d2 < MIN_IMPROVEMENT) {
      return { continue: false, reason: "stalled" };
    }
  }
  return { continue: true };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const raw = process.argv[2];
  if (!raw) {
    console.error(
      'usage: node corrector-guard.mjs \'{"history":[...],"threshold":0.90,"maxIter":5}\'',
    );
    process.exit(1);
  }
  try {
    const input = JSON.parse(raw);
    console.log(JSON.stringify(shouldContinue(input)));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
