import { readFile } from "node:fs/promises";
import { PNG } from "pngjs";

/**
 * @param {string} path
 */
export async function loadPng(path) {
  let buffer;
  try {
    buffer = await readFile(path);
  } catch (e) {
    throw new Error(
      `loadPng: failed to read file at ${path}: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    );
  }
  try {
    return PNG.sync.read(buffer);
  } catch (e) {
    throw new Error(
      `loadPng: not a valid PNG at ${path}: ${e instanceof Error ? e.message : String(e)}`,
      { cause: e },
    );
  }
}
