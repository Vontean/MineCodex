# CodexNotes implementation handoff

Last updated: 2026-08-09

## Current status

The Todo、Prompts、Files product seam and the native-parity responsive Summary Host
surface are implemented. The latest RuntimeHost uses the production Codex Summary
source/DOM audit as its contract: `overlay / shift / gutter` presentation、responsive
`Toggle notes` / `Toggle pinned notes` labels、layout reserve、conversation shift、
natural surface height and resolved semantic tokens.

Detail Tabs now prefer Codex's internal React right-panel controller. RuntimeHost discovers
the current hashed `app-initial` bundle, recovers the active `local-thread` Task scope and
mounts the existing Todo / Prompts / Files iframe as a native Task Tab. The former custom
Tab host remains only as capability fallback; Surface theme and Host-action bridges are
the same in both presentations.

All 90 original User Stories remain mapped in `IMPLEMENTATION_AUDIT.md`. The responsive
realignment addendum and the blocking visual result live in `design-qa.md`. Current
automated suites:

- CodexNotes Product / UI contract seam: 21 tests passing.
- CodexRuntimeHost manifest / Adapter seam: 13 tests passing.
- Syntax and `git diff --check`: passing in both repositories.

Delivery is local Git only. Push、remote creation、release and deployment are outside
this handoff.

## Repositories and ownership

### `/Users/mac/Project/harnessTools/CodexNotes`

Owns:

- Todo, Prompts and Files domain behavior.
- SQLite schema and all persistent mutations.
- loopback HTTP API and SSE revision stream.
- Summary and full Todo / Prompts / Files Web UI.
- feature contribution declaration in `codex-feature.json`.

Important files:

- `src/product.mjs` — deep Product Module and only database writer.
- `src/http-server.mjs` — HTTP / SSE Interface and macOS picker Adapter.
- `web/app.js` — all four Surface views and the narrow Host message client.
- `web/codex-plus.svg` — Add silhouette extracted from the native Codex Summary action.
- `test/summary-ui-contract.test.mjs` — native fixed-limit、single-scroller、token and icon contract.
- `codex-feature.json` — toolbar / pinned / tabs / Host capability manifest.
- `test/product-seam.test.mjs` — black-box HTTP, temporary-file, SSE and restart coverage.
- `spikes/phase0/` — repeatable Host seam evidence and file-drop probes.

### `/Users/mac/Project/harnessTools/CodexRuntimeHost`

Remains the sole Injector / Host Adapter. It was extended backward-compatibly for:

- `entry.kind: conversation-toolbar`.
- Pinned Summary definitions.
- native Task-scoped Detail Tab contributions with a compatibility-host fallback.
- strict Surface messages and allowed Host actions.
- native file attachment plus truthful path-insertion fallback.
- Finder `File` path resolution through the current Electron preload bridge.

The pre-existing local change from icon `stroke-width=2` to `1.5`, together with its
regression assertion, belonged to the user before this work and was preserved. Do not
silently revert it while reviewing the larger RuntimeHost diff.

## Product behavior

### Todo

- New active items appear first.
- Drag order is persisted as a complete active order; both quick and full Todo surfaces use the native Codex line-and-ring indicator to preview the exact before / after destination.
- Complete, restore, edit, immediate row delete and Completed Section batch Delete all are supported.
- Complete / restore is circle-only in both the quick surface and full Tab; clicking the Todo label or the rest of the row has no action.
- The quick summary has five Todo slots: Active fills them first and Completed fills any remainder with a filled check, strike-through and muted text. The full Tab removes its page-level title, keeps Completed below Active, places counts 12px after each native-style Section label, and keeps Add / Delete in their corresponding Section headers.
- There are no dates, reminders, Composer actions or Agent-driven writes.

### Prompts

- Optional title plus required multiline plaintext body.
- Empty title derives the first non-empty body line for display only.
- Insert is the only explicit row action; Pin and Delete live in More.
- Pinned comes first; unpinned recency changes after successful Insert or Edit.
- Host insertion respects the saved selection / caret and falls back to newline append.
- Nothing auto-sends.

### Files

- System picker and Finder drop add one or multiple regular files.
- Only canonical absolute paths and metadata are stored; bytes are never copied.
- Duplicate paths reuse one entry; successful calls control recency.
- Add prefers a real native Composer attachment. If no native chip is observed, Host
  inserts the absolute path and returns `mode: insert-path` for truthful UI feedback.
- Clicking a file name reveals and selects its canonical source in Finder on macOS or
  Explorer on Windows; Add and Delete remain separate actions. CodexNotes does not
  provide file rename.
- Missing references remove themselves; no disk search / relinking occurs.
- Removing an entry never deletes or moves the source file.

## Local source of truth

Default database:

```text
~/Library/Application Support/CodexNotes/codex-notes.sqlite
```

The service uses SQLite WAL mode, `BEGIN IMMEDIATE` mutations and a monotonic revision.
All open Surfaces receive the same SSE revision stream and refetch authoritative state.
Refreshes are single-flight, ignore an unchanged revision and also compare the `ready`
revision after SSE reconnect, so a disconnected Surface cannot remain permanently stale.
Ephemeral UI state—open editor and Todo / Prompt drafts—stays in the Surface and is not
overwritten by unrelated SSE refreshes; an item deleted in another Surface becomes an
explicit not-found editor state rather than silently turning into a new item.

Main API:

```text
GET    /api/health
GET    /api/state
GET    /api/events
POST   /api/todos
PATCH  /api/todos/:id
POST   /api/todos/reorder
DELETE /api/todos/:id
DELETE /api/todos/completed
POST   /api/prompts
PATCH  /api/prompts/:id
POST   /api/prompts/:id/use
DELETE /api/prompts/:id
POST   /api/files
POST   /api/files/pick
POST   /api/files/:id/use
POST   /api/files/:id/reveal
DELETE /api/files/:id
```

The HTTP service refuses non-loopback bind addresses. Mutation requests with an `Origin`
header are restricted to the exact loopback service origin; malformed paths and non-object
JSON bodies return stable 4xx error codes rather than escaping as 500s. Static files are
same-origin and have a small CSP. Image previews are streamed, capped at 64 MiB and use
ETag / Last-Modified validators. The Host independently validates both iframe origin and
source window, and the Surface pins subsequent messages to the Host origin learned during
the theme handshake.

Pinned-file existence cleanup is TTL-throttled, single-flight and concurrency-limited.
It runs behind state reads, times out an unresponsive path without deleting its metadata,
and removes confirmed-missing metadata in one mutation so concurrent activity cannot
produce duplicate revisions. Batch pinning bounds filesystem concurrency, Todo display
queries have covering sort indexes, Todo reorder membership uses a Set, and drag-over only
clears the previous drop row instead of scanning all rows.

All visible Surface copy, ARIA labels, Toasts, picker prompts and Host manifest labels have
English and Simplified Chinese forms. RuntimeHost resolves locale maps against the Codex
document language and includes that locale in the theme message; API error codes are
localized client-side. Host action and Surface identifiers remain locale-independent.

## Host Adapter evidence

The following was verified in an isolated Codex client using profile
`/tmp/codexnotes-host2.YaGMKb/codex-profile`, CDP port 9232 and Codex Framework
`151.0.7922.76`:

- one 28×28 icon entry with exact accessible state;
- open / close persistence, outside clicks, Escape and Thread switching;
- mutual exclusion with native Toggle Summary in both directions;
- new client session starts closed;
- stable Todo / Prompts / Files Tab identity, focus and close behavior;
- selected-range replacement and disconnected-range newline fallback;
- native Markdown attachment chip and native PNG image preview;
- no automatic Send, stale Thread or leftover attachment;
- forged top-window Host messages have no Composer or Tab side effect;
- live custom accent / focus / radius / shadow token propagation;
- service-offline isolation and recovery of an iframe that had never completed ready;
- Finder drop absolute path resolution through `electronBridge.getPathForFile`.
- responsive `overlay / shift / gutter` transitions at the audited thresholds;
- `shift` reserves the panel and moves conversation content by exactly `-158px` once;
- overlay anchors below the Notes action and avoids an open native right side panel;
- constrained height keeps one internal Summary scroller;
- native title、icon color、radius、shadow and spacing tokens propagate into the iframe;
- the Add action uses the native Codex filled path rather than the heavier Lucide stroke.

The app bundle strings `togglePinnedSummary` and `composer.addFiles` were orientation
evidence only. The implementation uses current DOM inference and a narrow CDP bridge,
not those strings as a contract.

## Run and verify

CodexNotes standalone:

```bash
cd /Users/mac/Project/harnessTools/CodexNotes
npm install
npm test
npm run check
npm start
```

Shared Host:

```bash
cd /Users/mac/Project/harnessTools/CodexRuntimeHost
npm test
npm run check:runtime
npm start
```

Isolated Host example:

```bash
CODEX_FEATURES_ROOT=/Users/mac/Project/harnessTools \
CODEX_RUNTIME_PROFILE_DIR=/tmp/codexnotes-profile \
CODEX_RUNTIME_CDP_PORT=9232 \
npm start
```

Do not point acceptance probes at the user's normal Codex profile. Phase 0 probe usage
is documented in `spikes/phase0/README.md`.

## Visual evidence

Local QA artifacts are under `output/playwright/` and intentionally ignored by Git.
They include constrained empty / populated summaries, three full views, the isolated
Host shell and the final dark 300×620 summary.

Fresh native-reference captures are under `output/audit/native-summary/`; corresponding
implementation and combined comparisons are under `output/audit/implementation/`.
The blocking result and evidence list are recorded in `design-qa.md`.

`Page.captureScreenshot` on the top app target does not paint OOPIF iframe contents;
a white iframe area in that capture is not evidence of a blank product. Inspect the
iframe target directly or use the standalone screenshots.

## Residual risk and future work

- Toolbar, Summary, Tab and Composer selectors are unsupported DOM inference.
- File attachment uses high-risk CDP (`DOM.setFileInputFiles`) and must be rechecked
  after a Codex desktop update.
- Finder path resolution uses a current internal preload interface, not a public API.
- The actual macOS picker opens a user-owned system modal, so unattended acceptance
  uses an injected picker result while the real JXA implementation remains available.
- Launch-at-login, packaging, automatic backup, import / export and deployment are out
  of scope.

CodexRuntimeHost owns future Codex host-compatibility repairs. The Product Module and
database remain independent; the standalone Summary Web UI changes only when the
documented Notes content or visual contract changes.

## Git handoff

CodexNotes and RuntimeHost are independent local Git repositories on `main`. Review and
commit them independently; push、remote creation、release and deployment remain separate
approvals.
