// HTTP client for the Figma REST API — base of the alternative path to the local Dev Mode MCP
// (see the header of scripts/figma-rest.mjs for when to use one or the other). Loads the PAT from
// .env, applies a throttle shared across processes and respects Retry-After on 429.
//
// The token is never printed — neither in a log nor in an error message. The .env is edited by the
// user (the pre-tool-use hook blocks Write/Edit on that file on purpose).

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API_BASE = "https://api.figma.com";

// REST Tier 1 (files/:key/nodes, images/:key) on a Dev/Full seat: 10/min on Starter,
// 15/min on Professional, 30/min on Enterprise. Default at the lowest — raise it via
// FIGMA_RATE_LIMIT_PER_MIN only when the plan actually allows it.
const DEFAULT_RATE_LIMIT_PER_MIN = 10;
const WINDOW_MS = 60_000;
const MAX_RETRIES = 4;

// The pipeline dispatches up to 4 sections in parallel, each running this script in a separate
// process — an in-memory-only limiter would not see the sibling calls. The state file is the
// shared sliding window; the 429 retry is the safety net.
const RATE_STATE_FILE = join(REPO_ROOT, ".claude", ".figma-rate-state.json");

/** Minimal .env parser — only KEY=VALUE, no interpolation and no export. */
function loadEnvFile() {
  /** @type {Record<string, string>} */
  const out = {};
  const envPath = join(REPO_ROOT, ".env");
  if (!existsSync(envPath)) return out;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    out[key] = value.replace(/^["'](.*)["']$/, "$1");
  }
  return out;
}

// Accepted names for the PAT, in precedence order. FIGMA_TOKEN is the canonical one; the others
// exist because the pre-tool-use hook already mentioned FIGMA_PAT and the .env may have been
// written before this convention — refusing the call because of the key name only creates friction.
const TOKEN_KEYS = ["FIGMA_TOKEN", "FIGMA_PAT", "PAT"];

/**
 * Figma PAT. An environment variable beats the .env, to allow a one-off override
 * without editing the file.
 * @returns {string}
 */
export function getToken() {
  const env = loadEnvFile();
  for (const key of TOKEN_KEYS) {
    const value = process.env[key] || env[key];
    if (value) return value;
  }
  throw new Error(
    `Figma token not found. Looked for the keys ${TOKEN_KEYS.join(", ")} in the environment and ` +
      "in the root .env. Generate a personal access token at Figma → Settings → Security → " +
      "Personal access tokens (files:read scope) and put it in the .env as FIGMA_TOKEN=figd_... " +
      "(.env is already in .gitignore).",
  );
}

function rateLimitPerMin() {
  const raw = process.env.FIGMA_RATE_LIMIT_PER_MIN;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RATE_LIMIT_PER_MIN;
}

/** @returns {number[]} timestamps of the calls still inside the window */
function readStamps() {
  try {
    const parsed = JSON.parse(readFileSync(RATE_STATE_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "number") : [];
  } catch {
    return []; // missing/corrupted state must not block the call — the 429 still protects us
  }
}

/** @param {number[]} stamps */
function writeStamps(stamps) {
  try {
    mkdirSync(dirname(RATE_STATE_FILE), { recursive: true });
    writeFileSync(RATE_STATE_FILE, JSON.stringify(stamps), "utf8");
  } catch {
    // losing the state only degrades the throttle down to the 429 retry — not a reason to abort
  }
}

/** Holds the call until there is room in the 60s window. */
async function reserveSlot() {
  const limit = rateLimitPerMin();
  for (;;) {
    const now = Date.now();
    const stamps = readStamps().filter((t) => now - t < WINDOW_MS);
    if (stamps.length < limit) {
      stamps.push(now);
      writeStamps(stamps);
      return;
    }
    writeStamps(stamps);
    await sleep(WINDOW_MS - (now - stamps[0]) + 50);
  }
}

/**
 * Authenticated GET on the Figma REST API, with throttle and 429 retry.
 * @param {string} path path starting with "/" (e.g. "/v1/files/KEY/nodes")
 * @param {Record<string, string | number | undefined>} [params]
 * @returns {Promise<any>}
 */
export async function figmaGet(path, params = {}) {
  const url = new URL(path, API_BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  for (let attempt = 0; ; attempt++) {
    await reserveSlot();
    const res = await fetch(url, { headers: { "X-Figma-Token": getToken() } });

    if (res.ok) return res.json();

    if (res.status === 429 && attempt < MAX_RETRIES) {
      // Retry-After comes in seconds and is the authoritative source — the local window is just a guess.
      const retryAfter = Number(res.headers.get("Retry-After")) || 30;
      await sleep(retryAfter * 1000);
      continue;
    }

    const body = await res.text().catch(() => "");
    throw new Error(figmaErrorMessage(res.status, url.pathname, body));
  }
}

/**
 * Error message with the likely cause — Figma's raw response is usually
 * too short to point at what to fix.
 * @param {number} status
 * @param {string} pathname
 * @param {string} body
 */
function figmaErrorMessage(status, pathname, body) {
  const detail = body.slice(0, 300);
  if (status === 403) {
    return `Figma REST 403 on ${pathname}: invalid or expired token, missing files:read scope, or no access to this file. Check the token in the .env and whether your account can see the file. ${detail}`;
  }
  if (status === 404) {
    return `Figma REST 404 on ${pathname}: fileKey or node id does not exist. Check that the fileKey came from the right URL and that the node-id uses ":" and not "-". ${detail}`;
  }
  if (status === 429) {
    return `Figma REST 429 on ${pathname}: rate limit persisted after ${MAX_RETRIES} retries. Reduce concurrency or wait a few minutes. ${detail}`;
  }
  return `Figma REST ${status} on ${pathname}: ${detail}`;
}

/**
 * Downloads a binary from an already signed URL (Figma's S3) — without a token header, which
 * those URLs neither accept nor need.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
export async function fetchBinary(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status}): ${url.slice(0, 120)}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Extracts fileKey and node-id from a Figma selection URL. The node-id comes with "-" in the URL
 * and has to become ":" for the REST API — the most common gotcha of this flow.
 * @param {string} figmaUrl
 * @returns {{fileKey: string, nodeId: string | null}}
 */
export function parseFigmaUrl(figmaUrl) {
  const keyMatch = figmaUrl.match(/\/(?:file|design|proto)\/([A-Za-z0-9]+)/);
  if (!keyMatch) {
    throw new Error(`Figma URL without a recognizable fileKey: ${figmaUrl.slice(0, 120)}`);
  }
  const nodeMatch = figmaUrl.match(/[?&]node-id=([^&]+)/);
  return {
    fileKey: keyMatch[1],
    nodeId: nodeMatch ? decodeURIComponent(nodeMatch[1]).replace(/-/g, ":") : null,
  };
}
