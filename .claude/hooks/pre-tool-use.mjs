#!/usr/bin/env node
// PreToolUse hook — scope + dependency guard.
// Runs BEFORE the tool. Can block (hookSpecificOutput.permissionDecision = "deny").
//
// Scope guard (Write/Edit):
// - Never lets you write/edit .env, .env.local (secret).
// - Never lets you write into output/ (old convention — a landing page goes in projects/<slug>/).
// - Never lets you write inside .git/ or node_modules/.
// - Never lets you CREATE a new project (projects/<slug>/ folder does not exist on disk yet)
//   with a slug that does not end in "-cpc", "-org" or "-obrigada" (rules/project-naming.md) — it forces
//   asking the user for the full production URL before writing any file.
// - It NO LONGER locks Write/Edit across multiple projects/<slug>/ in the same session — removed
//   at the user's request (2026-08-28). Editing more than one landing page at the same time still
//   requires explicit authorization from the user in the conversation (rules/core.md, Scope section);
//   that is now the agent's responsibility alone, with no mechanical hook lock.
//
// Dependency guard (Bash):
// - Blocks `npm install/i/add <pkg>` outside the allowlist authorized in this session
//   (CLAUDE.md: "Do not install dependencies without explicit authorization").
// - Shell redirection (`>`, `>>`, `<`, `2>&1` etc) is stripped before looking for
//   package names — otherwise "npm install 2>&1 | tail" treats "2>" as if it were a package.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const NPM_ALLOWLIST = ["puppeteer", "ssim.js", "pngjs", "zod", "sharp"];

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

function allowSilently() {
  process.exit(0);
}

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  allowSilently(); // without stdin there is nothing to check — fail open
}

let input;
try {
  input = JSON.parse(raw);
} catch {
  allowSilently(); // invalid JSON is not a reason to block the tool
}

const toolName = input.tool_name;
const toolInput = input.tool_input || {};
const projectRoot = process.cwd();

if (toolName === "Write" || toolName === "Edit") {
  const filePath = toolInput.file_path || "";
  const norm = filePath.replace(/\\/g, "/");

  if (/(^|\/)\.env(\.local)?$/.test(norm)) {
    deny(
      "Blocked by the hook: Write/Edit on .env/.env.local. That file holds secrets (FIGMA_PAT etc) — it must never be written/overwritten by the tool. Ask the user to edit that file directly.",
    );
  }

  if (/\/output\//.test(norm) || /(^|\/)output\/.*$/.test(norm)) {
    deny(
      'Blocked by the hook: path uses "output/" — old convention of this project. A landing page goes in projects/<slug>/ (CLAUDE.md Structure section, rules/core.md).',
    );
  }

  if (/\/(\.git|node_modules)\//.test(norm)) {
    deny(
      "Blocked by the hook: writing directly inside .git/ or node_modules/ is not expected in this project.",
    );
  }

  const m = norm.match(/\/projects\/([^/]+)\//);
  if (m) {
    const slug = m[1];
    const projectDir = join(projectRoot, "projects", slug);
    const isNewProject = !existsSync(projectDir);
    if (isNewProject && !/-(cpc|org|obrigada)$/.test(slug)) {
      deny(
        `Blocked by the hook: creating new project "projects/${slug}/" but the slug does not end in "-cpc", "-org" nor "-obrigada" (rules/project-naming.md). Ask the user for the full production URL of the page (it must end in -cpc for paid traffic, -org for organic, or -obrigada for a thank-you page) before creating the folder.`,
      );
    }
  }
}

if (toolName === "Bash") {
  const rawCommand = toolInput.command || "";
  // Strip the heredoc body (e.g. git commit -m "$(cat <<'EOF' ... EOF)") before scanning —
  // otherwise literal text like "npm install" in a commit message becomes a false positive.
  // Strip shell redirection (>, >>, <, 2>&1 etc) — otherwise "npm install 2>&1 | tail"
  // makes the "2>" (or the redirect's fd/target) get captured as if it were a package name.
  const command = rawCommand
    .replace(/<<-?\s*['"]?(\w+)['"]?\n[\s\S]*?\n\1\b/g, "")
    .replace(/\s*\d*(?:>{1,2}|<)&?\d*(?:\s+[^\s&|;\n]+)?/g, " ");
  const npmCallRe = /\bnpm\s+(?:install|i|add)\b([^\n&|;]*)/g;
  let match;
  while ((match = npmCallRe.exec(command))) {
    const argsStr = match[1] || "";
    const tokens = argsStr.trim().split(/\s+/).filter(Boolean);
    const pkgTokens = tokens.filter((t) => !t.startsWith("-"));
    for (const t of pkgTokens) {
      const pkgName = t.startsWith("@") ? "@" + t.slice(1).split("@")[0] : t.split("@")[0];
      if (!NPM_ALLOWLIST.includes(pkgName)) {
        deny(
          `Blocked by the hook: "npm install ${pkgName}" is not in the authorized allowlist (${NPM_ALLOWLIST.join(", ")}). CLAUDE.md: "Do not install dependencies without explicit authorization". Ask the user before installing.`,
        );
      }
    }
  }
}

allowSilently();
