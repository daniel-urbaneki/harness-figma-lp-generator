# Figma Rule

## MCP server — always local, always confirm first

Every Figma read uses the **local Dev Mode MCP server** (`http://127.0.0.1:3845/mcp`), served
by the Figma desktop app. Never use the remote server (`https://mcp.figma.com/mcp`): it authenticates
with the browser account, which may not be the file's owner — and then it answers 403 on a file the
user opens normally in the app, looking like a bug when it is permissions.

**Before the first Figma call in any task, ask the user whether the local MCP is
active.** Do not assume it is, even if it worked in a previous task — the server goes down
with the app. Ask **together with the links** for desktop and mobile (section "Selection links"),
in a single message, so the conversation is not sliced into three round trips.

If the user does not know the answer, check before asking again:

```bash
curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 http://127.0.0.1:3845/mcp
```

`000` = nothing listening (inactive). Any other code = server up.

**Careful — the port being up does not mean the server is usable.** The Dev Mode MCP only responds while
the Figma Desktop **active tab** is a design or FigJam file. With another tab in the foreground,
the port keeps returning `400` and the process keeps listening, but every tool call fails
with `The MCP server is only available if your active tab is a design or FigJam file`.

Typical symptom: `get_metadata` works and `get_design_context` fails repeatedly — a background
agent reads that as a timeout and retries for minutes. **On repeated failure of
`get_design_context`, stop after the 2nd attempt and ask the user to check the active tab**,
instead of continuing to retry. See the "Active tab" section of `README.md`.

If it is inactive, guide the user to activate it — Figma **desktop** app open, logged into the account that owns the
file, file open, menu **Figma → Preferences → "Enable local MCP server"**, and **restart the
Claude Code session** (MCP only loads at boot). If the toggle does not appear, the cause is almost always
an account without a Dev/Full seat on a paid plan. Full procedure, ways to verify and
diagnostics: section "Local Figma MCP" of `README.md`.

While the local MCP is unavailable: **stop and report**. Do not fall back to the remote server, do not
fall back to the REST path (`scripts/figma-rest.mjs`) and do not estimate a visual value on your own —
any of the three requires explicit user authorization (`rules/core.md`, Ambiguity).

## Asset URLs (`localhost:3845/assets/<hash>`) go stale — they are not permanent

An asset URL that `get_design_context` returned in an earlier extraction may answer `500
"Error getting image"` later, even with the local server active and the right tab in focus — **the
hash does not change, but the server requires a recent `get_design_context` call on that node to
serve the binary**. Observed behavior, not documented by Figma: it looks like a session
cache that expires by time, not by reconnection.

Symptom: `curl` on the asset URL returns `500` with body `Error getting image`; calling
`get_design_context` again on the same `nodeId` returns the **same URL** (identical hash), but now
it answers `200` with real bytes.

**Practical consequence:** whoever downloads the asset (`asset-reviewer`) cannot blindly trust
a `figmaUrl` that came from an extraction done much earlier (e.g. another session, or minutes ago
in a long run). Before a download batch, "warm up" each parent node with a
`get_design_context` call first — even if the return value is not used beyond the URL — and only then
download. If the download still fails with `500` after that, then it is the active tab (previous section)
or another real problem.

## Before implementing

For a new section or an LP rebuild, analyze in Figma:

1. Hierarchy — frame > group > component > element.
2. Components and instances — map the variants used.
3. Typography — family, weight, size, line-height and letter-spacing.
4. Colors — extract exact values from the design.
5. Spacing — padding, gap and relevant margins.
6. Assets — identify nodes that need to be exported (`rules/assets.md`).
7. Responsiveness — check existing mobile/tablet frames and breakpoints, when available.

## Selection links — always ask for both desktop AND mobile

Every analysis/extraction needs **two Figma links, provided by the user**:

- **desktop** — URL with the `node-id` of the section/frame on the 1920 side;
- **mobile** — URL with the `node-id` of the corresponding section/frame on the mobile side (430 in this
  project's standard, `rules/responsive.md` section 2).

Ask for both **at once, before starting**, whenever the user has not passed both
in the message — do not start with the desktop only and go find the mobile on your own.

The inference heuristic (look for a ~430px wide frame, sibling of the desktop on the same page
of the file) is **fallback only** — use it only when the user explicitly answers that they do not have
the mobile link, or asks you to infer. In that case:

- if the inference finds a candidate, **confirm with the user which node was chosen** before
  proceeding;
- if it finds none, record it as a pending item and ask how to proceed — never proceed with the
  desktop only silently, nor interpolate the mobile without authorization (`rules/core.md`, Ambiguity).

Reason: the mobile frame may be on another page of the file, have a width other than 430
(390/375/414) or a name that does not match the desktop one. None of these situations is detectable
reliably by the heuristic, and picking the wrong frame produces an LP whose responsiveness is faithful to the
wrong design — with no visible error at any step.

## Using the Figma MCP

- Consult the Figma MCP before making visual decisions.
- Do not estimate colors, spacing, typography or dimensions when the value can be obtained from Figma.
- If a required node is not accessible via MCP, report the problem and ask how to proceed.
- Do not replace inaccessible data with visual estimates without authorization.

## Fidelity

- Reproduce the frame's hierarchy and visual composition.
- Preserve the order, grouping and spatial relationships of the elements.
- Do not remove, reorder or group elements differently from Figma without justification.
- Do not create elements that are not present in the design or requested by the user.
