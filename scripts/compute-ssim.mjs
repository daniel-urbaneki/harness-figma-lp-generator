import { pathToFileURL } from "node:url";
import ssim from "ssim.js";
import { loadPng } from "./lib/load-png.mjs";

/**
 * @param {string} pathA
 * @param {string} pathB
 */
export async function computeSsim(pathA, pathB) {
  const [a, b] = await Promise.all([loadPng(pathA), loadPng(pathB)]);
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`SSIM: dimensions mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  const imgA = { data: a.data, width: a.width, height: a.height };
  const imgB = { data: b.data, width: b.width, height: b.height };
  // @ts-expect-error ssim.js exposes .default only at runtime (CJS/ESM interop) — the types do not declare it
  const result = ssim.default ? ssim.default(imgA, imgB) : ssim(imgA, imgB);
  return result.mssim;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , a, b] = process.argv;
  if (!a || !b) {
    console.error("usage: node compute-ssim.mjs <imgA.png> <imgB.png>");
    process.exit(1);
  }
  computeSsim(a, b)
    .then((s) => {
      console.log(JSON.stringify({ ssim: s }));
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    });
}
