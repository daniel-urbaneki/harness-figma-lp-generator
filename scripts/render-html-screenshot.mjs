import puppeteer from "puppeteer";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @param {{htmlPath: string, outPath: string, viewportWidth?: number, viewportHeight?: number, deviceScaleFactor?: number, fullPage?: boolean}} params
 */
export async function renderHtmlScreenshot({
  htmlPath,
  outPath,
  viewportWidth = 1920,
  viewportHeight = 1080,
  deviceScaleFactor = 1,
  fullPage = true,
}) {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: viewportWidth, height: viewportHeight, deviceScaleFactor });
    const url = pathToFileURL(resolve(htmlPath)).href;
    await page.goto(url, { waitUntil: "networkidle0", timeout: 10000 });
    await page.screenshot({ path: outPath, fullPage });
  } finally {
    await browser.close();
  }
}

// Resizes a PNG proportionally without depending on a new image lib (sharp/jimp) —
// reuses the Puppeteer that is already a project dependency. Used to normalize the screenshot of
// the Figma mobile frame (430px) to the closest dev breakpoint (390px) before SSIM/
// color-overlap — see evaluation.md, "Dimension matching".
/**
 * @param {{inPath: string, outPath: string, targetWidth: number}} params
 */
export async function resizePng({ inPath, outPath, targetWidth }) {
  const { PNG } = await import("pngjs");
  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(resolve(inPath));
  const src = PNG.sync.read(buffer);
  const targetHeight = Math.round((src.height / src.width) * targetWidth);
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: targetWidth, height: targetHeight, deviceScaleFactor: 1 });
    const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;
    await page.setContent(
      `<style>html,body{margin:0;padding:0}img{display:block;width:${targetWidth}px;height:${targetHeight}px}</style>` +
        `<img src="${dataUrl}">`,
    );
    await page.screenshot({
      path: outPath,
      clip: { x: 0, y: 0, width: targetWidth, height: targetHeight },
    });
  } finally {
    await browser.close();
  }
  return { width: targetWidth, height: targetHeight };
}

/**
 * @param {string} htmlPath
 * @param {{viewportWidth?: number, viewportHeight?: number, deviceScaleFactor?: number}} [opts]
 */
export async function extractBoundingBoxes(
  htmlPath,
  { viewportWidth = 1920, viewportHeight = 1080, deviceScaleFactor = 1 } = {},
) {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: viewportWidth, height: viewportHeight, deviceScaleFactor });
    await page.goto(pathToFileURL(resolve(htmlPath)).href, {
      waitUntil: "networkidle0",
      timeout: 10000,
    });
    return await page.evaluate(() => {
      /** @type {Record<string, {x: number, y: number, w: number, h: number}>} */
      const result = {};
      document.querySelectorAll("[data-figma-id]").forEach((el) => {
        const id = el.getAttribute("data-figma-id");
        if (id === null) return;
        const r = el.getBoundingClientRect();
        result[id] = { x: r.x, y: r.y, w: r.width, h: r.height };
      });
      return result;
    });
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , cmd, ...args] = process.argv;
  try {
    if (cmd === "screenshot") {
      const [htmlPath, outPath] = args;
      if (!htmlPath || !outPath) {
        console.error("usage: node render-html-screenshot.mjs screenshot <htmlPath> <outPath>");
        process.exit(1);
      }
      await renderHtmlScreenshot({ htmlPath, outPath });
      console.log(JSON.stringify({ ok: true, outPath }));
    } else if (cmd === "boxes") {
      const [htmlPath] = args;
      if (!htmlPath) {
        console.error("usage: node render-html-screenshot.mjs boxes <htmlPath>");
        process.exit(1);
      }
      const boxes = await extractBoundingBoxes(htmlPath);
      console.log(JSON.stringify(boxes));
    } else if (cmd === "resize") {
      const [inPath, outPath, targetWidthStr] = args;
      if (!inPath || !outPath || !targetWidthStr) {
        console.error(
          "usage: node render-html-screenshot.mjs resize <inPng> <outPng> <targetWidth>",
        );
        process.exit(1);
      }
      const result = await resizePng({ inPath, outPath, targetWidth: Number(targetWidthStr) });
      console.log(JSON.stringify({ ok: true, outPath, ...result }));
    } else {
      console.error(
        "usage: node render-html-screenshot.mjs <screenshot|boxes|resize> <htmlPath|inPng> [outPath] [targetWidth]",
      );
      process.exit(1);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
