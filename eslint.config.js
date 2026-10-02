import js from "@eslint/js";

const nodeGlobals = {
  process: "readonly",
  console: "readonly",
  // Node runtime globals used by the Figma REST client (scripts/lib/figma-http.mjs).
  fetch: "readonly",
  URL: "readonly",
  Buffer: "readonly",
};

const browserGlobals = {
  document: "readonly",
  window: "readonly",
};

export default [
  {
    // Third-party vendored asset — never lint/reformat (rules/assets.md).
    // Final LP JS (projects/**/js/ or projects/<slug>/main.js loose at the root — both
    // a valid convention, rules/html-css-js.md section 3) is delivery browser JS, not
    // the Node pipeline — not governed by this lint (CLAUDE.md/rules/tooling.md:
    // projects/<slug>/ follows only rules/validation.md, not the same verification as
    // scripts/*.mjs).
    ignores: [
      "projects/**/assets/vendor/**",
      "projects/**/js/**",
      "projects/*/main.js",
      "node_modules/**",
      "dist/**",
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: nodeGlobals,
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
    },
  },
  {
    // Puppeteer's page.evaluate() runs inside the browser, not in Node —
    // this file is the only one that references browser globals (document/window).
    files: ["scripts/render-html-screenshot.mjs"],
    languageOptions: {
      globals: { ...nodeGlobals, ...browserGlobals },
    },
  },
];
