import { z } from "zod";

export const Bbox = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const Asset = z.object({
  figmaUrl: z.string(),
  type: z.enum(["svg", "png", "jpg", "gif", "webp"]),
  usage: z.enum(["img", "background", "decorative"]),
  targetWidth: z.number().optional(),
  targetHeight: z.number().optional(),
  category: z.enum(["icons", "bgs", "logos"]).optional(),
  parentNodeId: z.string().optional(),
});

// Recursive schema — needs an explicit type annotation, otherwise TS cannot
// infer the type of LayoutNode from itself (circular reference via z.lazy).
/** @type {z.ZodType<any>} */
export const LayoutNode = z.object({
  type: z.string(),
  id: z.string(),
  name: z.string().optional(),
  bbox: Bbox.optional(),
  children: z.array(z.lazy(() => LayoutNode)).optional(),
});

// One side (desktop OR mobile) of a section's extraction. The Figma of this project only draws
// 2 sizes per section — desktop 1920 and mobile 430 (see rules/responsive.md section 2) — each
// one becomes a ViewportData inside the ExtractionOutput.
export const ViewportData = z.object({
  nodeId: z.string(),
  tokens: z.object({
    colors: z.record(z.string()),
    fonts: z.array(z.any()),
    spacing: z.array(z.number()),
  }),
  assets: z.array(Asset),
  layoutTree: LayoutNode,
  rawDesignContext: z.string(),
  screenshotPath: z.string(),
  figmaBbox: Bbox,
});

// One concrete structural difference between the desktop side and the mobile side of the SAME
// section (rules/responsive.md section 3). The extractor compares both frames node by node and
// emits one entry per difference found — this is what defines the HTML structure and the @media
// blocks, so it has to exist before the builder runs, not after.
export const LayoutDelta = z.object({
  // Node/element the difference refers to — the node name in Figma, or the id, whichever identifies it better.
  element: z.string(),
  kind: z.enum([
    "direction-flip", // layoutMode flips between the sides (row ↔ column)
    "grouping-needed", // one side groups children in a sub-frame that the other has flat — requires a wrapper
    "reorder", // the order of the children differs between the sides
    "desktop-only", // the node exists only in the desktop frame
    "mobile-only", // the node exists only in the mobile frame
    "rotation", // same vector, different rotation (e.g. vertical divider → horizontal)
    "alignment", // primaryAxis/counterAxis align differs between the sides
  ]),
  desktop: z.string(), // how it is on the desktop side
  mobile: z.string(), // how it is on the mobile side
  // What this difference requires from the HTML/CSS (e.g. "wrapper .s13-logos with display:contents on
  // desktop"). The builder follows this; it does not rediscover the difference on its own.
  implication: z.string(),
});

export const ExtractionOutput = z.object({
  sectionId: z.string(), // = desktop.nodeId, primary identity of the section
  sectionName: z.string(),
  desktop: ViewportData,
  // null when the orchestrator did not confidently find a corresponding mobile section —
  // in that case the builder falls back to interpolation (see html-generation.md)
  // and a warning is mandatory.
  mobile: ViewportData.nullable(),
  // true when the extractor identified a candidate carousel pattern (horizontal row of
  // cards, coverflow, name "carousel"/"slider"/"galeria" — rules/html-css-js.md section 7.1).
  // It is only a detection flag — the extractor never decides, the orchestrator asks the user
  // before dispatching the builder for that section.
  carouselCandidate: z.boolean().default(false),
  // true when the section is a top nav/header bar (logo + menu + CTA, first block of the
  // frame) — rules/page-structure.md. The builder emits <header> instead of <section
  // class="sN"> for it, and the orchestrator skips the <main> wrapper in aggregation when
  // any section of the page has this flag set. Detection only — the analyzer never decides.
  isHeader: z.boolean().default(false),
  // Structural desktop × mobile differences found in the node-by-node comparison
  // (rules/responsive.md section 3). Empty when both sides have the same structure, or when
  // `mobile` is null (no mobile frame — nothing to compare, falls back to marked interpolation).
  layoutDeltas: z.array(LayoutDelta).default([]),
  warnings: z.array(z.string()).default([]),
});

export const BuildOutput = z.object({
  sectionId: z.string(),
  html: z.string(),
  css: z.string(),
  js: z.string().default(""),
  assetPlaceholders: z.array(z.string()),
  dataFigmaIds: z.array(z.string()),
  warnings: z.array(z.string()).default([]),
});

export const AssetOutput = z.object({
  sectionId: z.string(),
  htmlPatched: z.string(),
  cssPatched: z.string(),
  assetFiles: z.array(
    z.object({
      path: z.string(),
      bytes: z.number(),
      type: z.string(),
    }),
  ),
});

export const Issue = z.object({
  element: z.string(),
  type: z.enum([
    "layout-offset",
    "color-mismatch",
    "missing-element",
    "extra-element",
    "text-mismatch",
    "size-mismatch",
  ]),
  // Which evaluation pass generated the issue — needed because each section is now evaluated
  // 2x (desktop 1920 and mobile 390), and the correction needs to know in which CSS block
  // (base or @media) to apply the fix.
  breakpoint: z.enum(["desktop", "mobile"]),
  expected: z.unknown(),
  actual: z.unknown(),
  delta: z.string(),
});

export const EvalOutput = z.object({
  score: z.number().min(0).max(1),
  signals: z.object({
    ssim: z.number().min(0).max(1),
    layoutIoU: z.number().min(0).max(1),
    colorOverlap: z.number().min(0).max(1),
  }),
  issues: z.array(Issue),
  recommendations: z.array(z.string()),
});

export const CorrectionOutput = z.object({
  sectionId: z.string(),
  htmlPatched: z.string(),
  cssPatched: z.string(),
  jsPatched: z.string().default(""),
  changelog: z.array(
    z.object({
      change: z.string(),
      reason: z.string(),
    }),
  ),
});
