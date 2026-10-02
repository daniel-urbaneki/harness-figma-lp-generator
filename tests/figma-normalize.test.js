import { describe, it, expect } from "vitest";
import {
  rgbaToHex,
  categorizeAsset,
  normalizeSection,
  listSections,
} from "../scripts/lib/figma-normalize.mjs";

/** @param {number} x @param {number} y @param {number} width @param {number} height */
const box = (x, y, width, height) => ({ absoluteBoundingBox: { x, y, width, height } });

// Synthetic section with the cases the extraction has to get right: multi-fragment icon,
// background by area, logo by name, invisible node and text.
const section = {
  id: "1:100",
  name: "Hero",
  type: "FRAME",
  layoutMode: "VERTICAL",
  itemSpacing: 24,
  paddingTop: 80,
  ...box(100, 200, 1920, 1000),
  children: [
    {
      id: "1:101",
      name: "bg-hero",
      type: "RECTANGLE",
      fills: [{ type: "IMAGE", imageRef: "abc", scaleMode: "FILL" }],
      ...box(100, 200, 1920, 1000),
    },
    {
      id: "1:102",
      name: "Título",
      type: "TEXT",
      characters: "Pós-graduação",
      style: { fontFamily: "Inter", fontWeight: 700, fontSize: 64, lineHeightPx: 72 },
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1, a: 1 } }],
      ...box(150, 300, 800, 72),
    },
    {
      id: "1:103",
      name: "icon-check",
      type: "INSTANCE",
      ...box(150, 400, 24, 24),
      children: [
        { id: "1:104", name: "Vector", type: "VECTOR", ...box(150, 400, 12, 24) },
        { id: "1:105", name: "Vector", type: "VECTOR", ...box(162, 400, 12, 24) },
      ],
    },
    {
      id: "1:106",
      name: "Logo Marca",
      type: "FRAME",
      ...box(150, 500, 120, 40),
      children: [{ id: "1:107", name: "Vector", type: "VECTOR", ...box(150, 500, 120, 40) }],
    },
    { id: "1:108", name: "escondido", type: "FRAME", visible: false, ...box(150, 600, 100, 100) },
  ],
};

describe("rgbaToHex", () => {
  it("converts Figma 0..1 channels to hex", () => {
    expect(rgbaToHex({ r: 1, g: 1, b: 1 })).toBe("#ffffff");
    expect(rgbaToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
    expect(rgbaToHex({ r: 0.318, g: 0.557, b: 1 })).toBe("#518eff");
  });
});

describe("categorizeAsset", () => {
  it("sends a logo to logos even when it is small", () => {
    expect(categorizeAsset("Logo Marca", "img", 40)).toBe("logos");
  });
  it("sends a small icon to icons and a large image to bgs", () => {
    expect(categorizeAsset("icon-check", "img", 24)).toBe("icons");
    expect(categorizeAsset("foto-turma", "img", 800)).toBe("bgs");
  });
  it("a background always goes to bgs", () => {
    expect(categorizeAsset("hero", "background", 1920)).toBe("bgs");
  });
});

describe("normalizeSection", () => {
  const result = normalizeSection(section);

  it("normalizes the section bbox to origin 0,0", () => {
    expect(result.figmaBbox).toEqual({ x: 0, y: 0, w: 1920, h: 1000 });
  });

  it("repositions the children relative to the section origin", () => {
    const title = result.layoutTree.children.find((/** @type {any} */ c) => c.id === "1:102");
    expect(title.bbox).toEqual({ x: 50, y: 100, w: 800, h: 72 });
  });

  it("excludes an invisible node from the tree", () => {
    const ids = result.layoutTree.children.map((/** @type {any} */ c) => c.id);
    expect(ids).not.toContain("1:108");
  });

  it("exports the icon through the container, not through the fragments", () => {
    // rules/assets.md section 4: two sibling VECTORs under the same INSTANCE are ONE icon.
    const icon = result.assets.filter((a) => a.nodeId === "1:103");
    expect(icon).toHaveLength(1);
    expect(icon[0]).toMatchObject({ type: "svg", category: "icons" });
    const fragmentIds = result.assets.map((a) => a.nodeId);
    expect(fragmentIds).not.toContain("1:104");
    expect(fragmentIds).not.toContain("1:105");
  });

  it("classifies an image fill that covers the section as background", () => {
    const bg = result.assets.find((a) => a.nodeId === "1:101");
    expect(bg).toMatchObject({ usage: "background", category: "bgs", type: "png" });
  });

  it("recognizes the logo by the node name", () => {
    expect(result.assets.find((a) => a.nodeId === "1:106")).toMatchObject({
      type: "svg",
      category: "logos",
    });
  });

  it("collects the real typography and spacing, without rounding", () => {
    expect(result.tokens.fonts).toEqual([{ family: "Inter", weights: [700], sizes: [64] }]);
    expect(result.tokens.spacing).toEqual([24, 80]);
    expect(result.tokens.colors).toHaveProperty("c-ffffff", "#ffffff");
  });

  it("preserves auto-layout in the design context", () => {
    expect(result.designContext.layout).toMatchObject({
      mode: "VERTICAL",
      itemSpacing: 24,
      padding: { top: 80, right: 0, bottom: 0, left: 0 },
    });
  });

  it("preserves the literal text from Figma", () => {
    const title = result.designContext.children.find((/** @type {any} */ c) => c.id === "1:102");
    expect(title.text).toMatchObject({ characters: "Pós-graduação", fontSize: 64 });
  });
});

describe("listSections", () => {
  it("lists only frames tall enough, sorted by y", () => {
    const root = {
      id: "0:1",
      children: [
        { id: "1:2", name: "Footer", type: "FRAME", ...box(0, 3000, 1920, 400) },
        { id: "1:1", name: "Hero", type: "FRAME", ...box(0, 0, 1920, 900) },
        { id: "1:3", name: "divisor", type: "FRAME", ...box(0, 950, 1920, 2) },
      ],
    };
    expect(listSections(root).map((/** @type {any} */ s) => s.name)).toEqual(["Hero", "Footer"]);
  });
});
