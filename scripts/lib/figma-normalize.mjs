// Converts the raw JSON of a Figma REST node (/v1/files/:key/nodes) into the parts of
// ViewportData: layoutTree, tokens, assets and a pruned design context. Used only by the
// alternative REST path (scripts/figma-rest.mjs) — the default pipeline reads via the local MCP.
//
// Why prune: the raw JSON of a section easily goes past hundreds of KB (vector geometry,
// redundant bounds, defaults repeated on every node) and the frontend-builder reads that whole
// field. Only what decides HTML/CSS stays here — layout, typography, color, radius, effect, rotation.
//
// Why this is more faithful than the MCP's React+Tailwind snippet: the values come exact
// (hex, px, lineHeightPx, letterSpacing) instead of rounded to the nearest utility class —
// rules/html-css-js.md forbids approximating a value that Figma has exact.

// Pure vector node: becomes SVG, never rebuilt in HTML/CSS (rules/assets.md section 3).
const VECTOR_TYPES = new Set([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "LINE",
  "REGULAR_POLYGON",
  "STAR",
  "ELLIPSE",
]);

// Containers that may wrap a multi-fragment icon — export from here, not from the children
// (rules/assets.md section 4, "Multi-fragment icon detection").
const CONTAINER_TYPES = new Set(["INSTANCE", "COMPONENT", "COMPONENT_SET", "GROUP", "FRAME"]);

const ICON_MAX_DIMENSION = 64; // rules/assets.md section 7
const BACKGROUND_AREA_RATIO = 0.6; // covers most of the section → usage "background"

/**
 * @param {{r: number, g: number, b: number, a?: number}} color Figma 0..1 channels
 * @returns {string} hex #rrggbb
 */
export function rgbaToHex(color) {
  const channel = (/** @type {number} */ v) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

/** @param {any} node */
function isVisible(node) {
  return node?.visible !== false;
}

/**
 * bbox relative to the section origin — an absolute canvas coordinate is useless
 * in the HTML and pollutes the desktop vs mobile comparison.
 * @param {any} node
 * @param {{x: number, y: number}} origin
 */
function relativeBbox(node, origin) {
  const box = node?.absoluteBoundingBox;
  if (!box) return undefined;
  return {
    x: round(box.x - origin.x),
    y: round(box.y - origin.y),
    w: round(box.width),
    h: round(box.height),
  };
}

/** @param {number} n */
function round(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Every solid/gradient fill with its blendMode — the individual blendMode matters: without it
 * the gradient-text gotcha from rules/html-css-js.md renders transparent.
 * @param {any[]} fills
 */
function summarizeFills(fills) {
  if (!Array.isArray(fills)) return undefined;
  const out = fills
    .filter((f) => f?.visible !== false)
    .map((f) => {
      /** @type {Record<string, any>} */
      const entry = { type: f.type };
      if (f.blendMode && f.blendMode !== "NORMAL") entry.blendMode = f.blendMode;
      if (typeof f.opacity === "number" && f.opacity !== 1) entry.opacity = f.opacity;
      if (f.type === "SOLID" && f.color) {
        entry.hex = rgbaToHex(f.color);
        if (typeof f.color.a === "number" && f.color.a !== 1) entry.alpha = round(f.color.a);
      }
      if (String(f.type).startsWith("GRADIENT") && Array.isArray(f.gradientStops)) {
        entry.stops = f.gradientStops.map((/** @type {any} */ s) => ({
          position: round(s.position),
          hex: rgbaToHex(s.color),
          alpha: typeof s.color?.a === "number" ? round(s.color.a) : 1,
        }));
        if (Array.isArray(f.gradientHandlePositions)) {
          entry.handles = f.gradientHandlePositions.map((/** @type {any} */ h) => ({
            x: round(h.x),
            y: round(h.y),
          }));
        }
      }
      if (f.type === "IMAGE") {
        entry.imageRef = f.imageRef;
        entry.scaleMode = f.scaleMode;
      }
      return entry;
    });
  return out.length ? out : undefined;
}

/** @param {any[]} effects */
function summarizeEffects(effects) {
  if (!Array.isArray(effects)) return undefined;
  const out = effects
    .filter((e) => e?.visible !== false)
    .map((e) => ({
      type: e.type,
      radius: e.radius,
      ...(e.color ? { hex: rgbaToHex(e.color), alpha: round(e.color.a ?? 1) } : {}),
      ...(e.offset ? { offset: { x: round(e.offset.x), y: round(e.offset.y) } } : {}),
      ...(typeof e.spread === "number" && e.spread !== 0 ? { spread: e.spread } : {}),
    }));
  return out.length ? out : undefined;
}

/** @param {any} node */
function summarizeText(node) {
  if (node.type !== "TEXT") return undefined;
  const s = node.style || {};
  return {
    characters: node.characters,
    fontFamily: s.fontFamily,
    fontWeight: s.fontWeight,
    fontSize: s.fontSize,
    lineHeightPx: typeof s.lineHeightPx === "number" ? round(s.lineHeightPx) : undefined,
    letterSpacing: typeof s.letterSpacing === "number" ? round(s.letterSpacing) : undefined,
    textAlignHorizontal: s.textAlignHorizontal,
    textCase: s.textCase,
    textDecoration: s.textDecoration,
  };
}

/**
 * Pruned design context — one object per node, only with what becomes HTML/CSS.
 * @param {any} node
 * @param {{x: number, y: number}} origin
 * @returns {any}
 */
export function buildDesignContext(node, origin) {
  /** @type {Record<string, any>} */
  const entry = {
    id: node.id,
    name: node.name,
    type: node.type,
    bbox: relativeBbox(node, origin),
  };

  // Auto-layout: this is what determines flex-direction, gap, padding and alignment.
  if (node.layoutMode && node.layoutMode !== "NONE") {
    entry.layout = {
      mode: node.layoutMode,
      itemSpacing: node.itemSpacing,
      padding: {
        top: node.paddingTop ?? 0,
        right: node.paddingRight ?? 0,
        bottom: node.paddingBottom ?? 0,
        left: node.paddingLeft ?? 0,
      },
      primaryAxisAlignItems: node.primaryAxisAlignItems,
      counterAxisAlignItems: node.counterAxisAlignItems,
      layoutWrap: node.layoutWrap,
    };
  }
  if (node.layoutSizingHorizontal || node.layoutSizingVertical) {
    entry.sizing = {
      horizontal: node.layoutSizingHorizontal,
      vertical: node.layoutSizingVertical,
    };
  }

  const fills = summarizeFills(node.fills);
  if (fills) entry.fills = fills;
  const strokes = summarizeFills(node.strokes);
  if (strokes) {
    entry.strokes = strokes;
    entry.strokeWeight = node.strokeWeight;
  }
  const effects = summarizeEffects(node.effects);
  if (effects) entry.effects = effects;

  if (typeof node.cornerRadius === "number" && node.cornerRadius !== 0) {
    entry.cornerRadius = node.cornerRadius;
  }
  if (Array.isArray(node.rectangleCornerRadii)) {
    entry.cornerRadii = node.rectangleCornerRadii;
  }
  if (typeof node.opacity === "number" && node.opacity !== 1) entry.opacity = node.opacity;
  if (typeof node.rotation === "number" && node.rotation !== 0) {
    entry.rotation = round((node.rotation * 180) / Math.PI); // Figma gives radians; CSS uses degrees
  }
  if (node.clipsContent) entry.clipsContent = true;

  const text = summarizeText(node);
  if (text) entry.text = text;

  const children = (node.children || []).filter(isVisible);
  if (children.length) {
    entry.children = children.map((/** @type {any} */ c) => buildDesignContext(c, origin));
  }
  return entry;
}

/**
 * Normalized layout tree — only shape and position, no style (the design context covers style).
 * @param {any} node
 * @param {{x: number, y: number}} origin
 * @returns {any}
 */
export function buildLayoutTree(node, origin) {
  const children = (node.children || []).filter(isVisible);
  /** @type {Record<string, any>} */
  const out = {
    type: String(node.type || "FRAME").toLowerCase(),
    id: node.id,
    name: node.name,
    bbox: relativeBbox(node, origin),
  };
  if (children.length) {
    out.children = children.map((/** @type {any} */ c) => buildLayoutTree(c, origin));
  }
  return out;
}

/**
 * Colors, fonts and spacings used in the section.
 * `colors` comes out sorted by frequency (key `c-<hex>`) — the semantic name of the CSS variable
 * is the builder's decision, not ours; here we only say which color dominates.
 * @param {any} node
 */
export function collectTokens(node) {
  /** @type {Map<string, number>} */
  const colorCount = new Map();
  /** @type {Map<string, {family: string, weights: Set<number>, sizes: Set<number>}>} */
  const fonts = new Map();
  /** @type {Set<number>} */
  const spacing = new Set();

  /** @param {any} n */
  const walk = (n) => {
    if (!isVisible(n)) return;
    for (const paint of [...(n.fills || []), ...(n.strokes || [])]) {
      if (paint?.type === "SOLID" && paint.color && paint.visible !== false) {
        const hex = rgbaToHex(paint.color);
        colorCount.set(hex, (colorCount.get(hex) || 0) + 1);
      }
    }
    if (n.type === "TEXT" && n.style?.fontFamily) {
      const key = n.style.fontFamily;
      const bucket = fonts.get(key) || { family: key, weights: new Set(), sizes: new Set() };
      if (n.style.fontWeight) bucket.weights.add(n.style.fontWeight);
      if (n.style.fontSize) bucket.sizes.add(round(n.style.fontSize));
      fonts.set(key, bucket);
    }
    for (const key of [
      "itemSpacing",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
    ]) {
      const value = n[key];
      if (typeof value === "number" && value > 0) spacing.add(round(value));
    }
    for (const child of n.children || []) walk(child);
  };
  walk(node);

  /** @type {Record<string, string>} */
  const colors = {};
  for (const [hex] of [...colorCount.entries()].sort((a, b) => b[1] - a[1])) {
    colors[`c-${hex.slice(1)}`] = hex;
  }

  return {
    colors,
    fonts: [...fonts.values()].map((f) => ({
      family: f.family,
      weights: [...f.weights].sort((a, b) => a - b),
      sizes: [...f.sizes].sort((a, b) => a - b),
    })),
    spacing: [...spacing].sort((a, b) => a - b),
  };
}

/**
 * Target category of the asset (rules/assets.md section 7).
 * @param {string} name
 * @param {"img" | "background" | "decorative"} usage
 * @param {number} maxDimension
 * @returns {"icons" | "bgs" | "logos"}
 */
export function categorizeAsset(name, usage, maxDimension) {
  if (/logo|brand|wordmark|marca|selo/i.test(name)) return "logos";
  if (usage === "background") return "bgs";
  if (maxDimension <= ICON_MAX_DIMENSION) return "icons";
  return "bgs";
}

/**
 * Nodes that must become an asset file.
 *
 * Core rule (rules/assets.md section 4): when a container only has vectors inside, it is ONE
 * icon — the container gets exported, not each fragment. That is why the walk stops descending
 * as soon as it recognizes a purely vector container.
 *
 * @param {any} root
 * @param {{x: number, y: number}} origin
 * @param {number} sectionArea
 * @returns {{assets: any[], warnings: string[]}}
 */
export function collectAssets(root, origin, sectionArea) {
  /** @type {any[]} */
  const assets = [];
  /** @type {string[]} */
  const warnings = [];

  /** Is the subtree purely vector (no text, at least one vector)? @param {any} n */
  const isPureVectorSubtree = (n) => {
    let hasVector = false;
    /** @param {any} x */
    const scan = (x) => {
      if (x.type === "TEXT") return false;
      if (VECTOR_TYPES.has(x.type)) hasVector = true;
      for (const child of x.children || []) {
        if (!scan(child)) return false;
      }
      return true;
    };
    return scan(n) && hasVector;
  };

  /** @param {any} n */
  const hasImageFill = (n) =>
    Array.isArray(n.fills) && n.fills.some((/** @type {any} */ f) => f?.type === "IMAGE");

  /** @param {any} node */
  const walk = (node) => {
    if (!isVisible(node)) return;

    const box = node.absoluteBoundingBox;
    const width = box ? round(box.width) : 0;
    const height = box ? round(box.height) : 0;
    const area = width * height;

    if (hasImageFill(node)) {
      const usage =
        sectionArea > 0 && area / sectionArea >= BACKGROUND_AREA_RATIO ? "background" : "img";
      assets.push({
        nodeId: node.id,
        name: node.name,
        type: "png", // raster becomes AVIF later (rules/assets.md section 5) — the asset-reviewer converts
        usage,
        targetWidth: width,
        targetHeight: height,
        category: categorizeAsset(node.name || "", usage, Math.max(width, height)),
      });
      return; // children of a node with an image fill are not assets of their own
    }

    const isContainer = CONTAINER_TYPES.has(node.type);
    if ((isContainer || VECTOR_TYPES.has(node.type)) && isPureVectorSubtree(node)) {
      const usage = /** @type {"img"} */ ("img");
      assets.push({
        nodeId: node.id,
        name: node.name,
        type: "svg",
        usage,
        targetWidth: width,
        targetHeight: height,
        category: categorizeAsset(node.name || "", usage, Math.max(width, height)),
      });
      return; // stop descending: the whole container is the icon
    }

    // Gotcha documented in rules/assets.md section 4: an INSTANCE of a remote library component
    // may have every child visible:false and still render on the canvas.
    if (node.type === "INSTANCE" && (node.children || []).length > 0) {
      const allHidden = node.children.every((/** @type {any} */ c) => c.visible === false);
      if (allHidden) {
        assets.push({
          nodeId: node.id,
          name: node.name,
          type: "svg",
          usage: "img",
          targetWidth: width,
          targetHeight: height,
          category: categorizeAsset(node.name || "", "img", Math.max(width, height)),
        });
        warnings.push(
          `INSTANCE "${node.name}" (${node.id}) has every child invisible — remote library component. Check the real pixel content of the export; if it comes out empty, export the parent node (rules/assets.md section 4).`,
        );
        return;
      }
    }

    for (const child of node.children || []) walk(child);
  };

  walk(root);
  return { assets, warnings };
}

/**
 * Normalizes a whole section node into the parts of ViewportData.
 * @param {any} document node coming from nodes[<id>].document
 * @returns {{nodeId: string, figmaBbox: {x: number, y: number, w: number, h: number}, layoutTree: any, tokens: any, assets: any[], designContext: any, warnings: string[]}}
 */
export function normalizeSection(document) {
  const box = document.absoluteBoundingBox;
  if (!box) {
    throw new Error(
      `node ${document.id} has no absoluteBoundingBox — it is not a renderable frame/section`,
    );
  }
  const origin = { x: box.x, y: box.y };
  const figmaBbox = { x: 0, y: 0, w: round(box.width), h: round(box.height) };
  const { assets, warnings } = collectAssets(document, origin, figmaBbox.w * figmaBbox.h);

  return {
    nodeId: document.id,
    figmaBbox,
    layoutTree: buildLayoutTree(document, origin),
    tokens: collectTokens(document),
    assets,
    designContext: buildDesignContext(document, origin),
    warnings,
  };
}

/**
 * Direct children that count as a landing section — used by the orchestrator's split.
 * Same criteria as SKILL.md: visible FRAME with height > 200, sorted by y.
 * @param {any} document
 * @param {number} [minHeight]
 */
export function listSections(document, minHeight = 200) {
  return (document.children || [])
    .filter(
      (/** @type {any} */ c) =>
        isVisible(c) &&
        (c.type === "FRAME" || c.type === "COMPONENT" || c.type === "INSTANCE") &&
        (c.absoluteBoundingBox?.height ?? 0) > minHeight,
    )
    .map((/** @type {any} */ c) => ({
      nodeId: c.id,
      name: c.name,
      type: c.type,
      y: round(c.absoluteBoundingBox.y),
      width: round(c.absoluteBoundingBox.width),
      height: round(c.absoluteBoundingBox.height),
    }))
    .sort((/** @type {any} */ a, /** @type {any} */ b) => a.y - b.y);
}
