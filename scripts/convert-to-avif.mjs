// Converts a raster (PNG/JPEG/other) downloaded from Figma to AVIF, preserving visual
// fidelity — used when a direct AVIF export is not possible (rules/assets.md section 5).
// Never use it on an SVG — an SVG stays an SVG (rules/assets.md, "Priority").

import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const DEFAULT_QUALITY = 75;

/**
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {number} [quality]
 */
export async function convertToAvif(inputPath, outputPath, quality = DEFAULT_QUALITY) {
  if (!existsSync(inputPath)) {
    throw new Error(`convert-to-avif: input file does not exist: ${inputPath}`);
  }
  await sharp(inputPath).avif({ quality }).toFile(outputPath);
  return outputPath;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , input, output, qualityArg] = process.argv;
  if (!input || !output) {
    console.error("usage: node convert-to-avif.mjs <input.png|jpg> <output.avif> [quality=75]");
    process.exit(1);
  }
  const quality = qualityArg ? Number(qualityArg) : DEFAULT_QUALITY;
  convertToAvif(input, output, quality)
    .then((out) => {
      console.log(JSON.stringify({ output: out, quality }));
    })
    .catch((e) => {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    });
}
