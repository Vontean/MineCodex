# CodexNotes PRD implementation audit

Audit date: 2026-08-08

Status: implemented. The original 90-story evidence table remains below; the
2026-08-08 responsive realignment was additionally verified through RuntimeHost helper
tests、live isolated Codex inspection and `design-qa.md`.

Responsive addendum: `overlay / shift / gutter` thresholds、responsive labels、single
content shift、Popover/right-panel collision handling、intrinsic panel height、continuous
inner scrolling and native Summary tokens all pass in the current reference build.

Original result: all 90 MVP User Stories in the earlier `PRD.md` had an implementation
path and acceptance evidence. The Host Adapter evidence was collected only in the isolated
profile `/tmp/codexnotes-host2.YaGMKb/codex-profile` on CDP port 9232, using
Chrome / Codex Framework `151.0.7922.76`.

Evidence keys:

- **P** — automated CodexNotes Product-seam test.
- **H** — automated RuntimeHost manifest / Adapter test.
- **L** — live isolated Codex Renderer verification.
- **V** — Playwright or screenshot visual / interaction verification.
- **S** — source or architecture constraint with no hidden product behavior.

| Story | Result | Acceptance evidence |
| ---: | :---: | --- |
| 1 | Pass | **L** One Notes entry appears in the active conversation toolbar. |
| 2 | Pass | **L** Entry is one native-cloned 28×28 icon button with a 20px Lucide glyph; its normalized closed state is transparent with tertiary icon color, while hover/open use the native list-hover token. |
| 3 | Pass | **H/L** Tooltip and accessible label resolve to `Toggle notes` in overlay and `Toggle pinned notes` in shift/gutter. |
| 4 | Pass | **L** The same button opens an anchored Popover in overlay or an inline Pinned Notes Surface in shift/gutter. |
| 5 | Pass | **L** Clicking the same entry again closes it and restores a transparent background with `aria-pressed=false` / `data-state=closed`. |
| 6 | Pass | **L** Composer / conversation clicks dismiss overlay but do not dismiss the inline surface. |
| 7 | Pass | **L** Escape dismisses overlay but does not dismiss the inline surface. |
| 8 | Pass | **L** Opening Notes closes the native Summary Surface. |
| 9 | Pass | **L** Opening native Summary closes Notes and restores the Notes entry to the same transparent closed state. |
| 10 | Pass | **L** Thread switch closes Notes; returning does not restore it. |
| 11 | Pass | **L** A terminated and freshly relaunched isolated client starts with no Notes Surface or Tab. |
| 12 | Pass | **H/L** Repeated `ensure()` calls and React mutations still leave exactly one entry. |
| 13 | Pass | **V** Summary renders Todo, Notes and Files vertically in one container. |
| 14 | Pass | **V** Flat rows, native-like section labels and 0.5px dividers are used. |
| 15 | Pass | **P/V** All three headers remain visible at 300×620 and constrained heights. |
| 16 | Pass | **P** Every Section keeps intrinsic height and defaults to at most its five highest-priority rows; View all appears only above that limit. |
| 17 | Pass | **P/V** One continuous inner scroller appears only when intrinsic content exceeds available Host height. |
| 18 | Pass | **V** Row labels are single-line with ellipsis overflow. |
| 19 | Pass | **V** Hover / focus-within reveals the row background and local actions only. |
| 20 | Pass | **H/L** Each View all opens its corresponding native Codex right-side Detail Tab in the current Task scope; capability failure retains the compatibility host fallback. |
| 21 | Pass | **H/L** Todo, Prompts and Files have independent stable native Tab identities. |
| 22 | Pass | **H/L** Reopening Prompts returned `focusedExisting: true` and kept exactly one native Tab. |
| 23 | Pass | **H/L** The native close button removed the panel and Surface bridge; reopening from View all restored it without changing Product state. |
| 24 | Pass | **S/V** No Surface renders a search input. |
| 25 | Pass | **S/V** Management remains row-scoped except the explicit Completed Section batch Delete; there is no arbitrary multi-select state. |
| 26 | Pass | **P/S** Every Surface reads the one local SQLite-backed service state. |
| 27 | Pass | **V** Todo Summary exposes its plus action; the full Tab places a compact Plus + Add button in the Active Section header. |
| 28 | Pass | **S** Todo schema and forms contain no due date, reminder or calendar state. |
| 29 | Pass | **P** New Todo is inserted before the prior active order. |
| 30 | Pass | **P/V** Active rows show the native Codex line-and-ring before / after indicator while dragging, and POST the complete durable order matching that visible destination. |
| 31 | Pass | **P** Manual order survives later creation and service restart. |
| 32 | Pass | **P/V** The explicit Edit action opens editing and PATCH persists text; the row label itself is non-interactive. |
| 33 | Pass | **P/V** Only the leading circular checkbox completes or restores a Todo in both Summary and the full Tab. |
| 34 | Pass | **P/V** Quick-summary Todo allocation consumes Active first, then Completed fills any of the five remaining slots. |
| 35 | Pass | **P/V** Completed summary rows use a filled circular check, centered strike-through and tertiary text while remaining available in the full Tab. |
| 36 | Pass | **P** Completed Todo restores to the front of Active. |
| 37 | Pass | **P/V** The Completed Section Delete all button removes all completed Todo in one declared batch action. |
| 38 | Pass | **P** DELETE is immediate, permanent and has no confirmation / Undo state. |
| 39 | Pass | **S** No Agent input, conversation parser or automated Todo mutation path exists. |
| 40 | Pass | **S/V** Todo rows expose edit, complete / restore and delete only—no Copy, Insert or Send. |
| 41 | Pass | **P/V** Notes persist reusable plaintext independently of Thread context. |
| 42 | Pass | **P** Optional title and exact multiline body fidelity are covered. |
| 43 | Pass | **P** Empty title derives the first non-empty body line without changing stored text. |
| 44 | Pass | **V** Notes Section plus opens the in-Surface Note editor. |
| 45 | Pass | **V** Note row primary action opens title / body editing. |
| 46 | Pass | **P/V** Insert is the only explicit Note hover action and recency is accepted only after success. |
| 47 | Pass | **L** Insert is an explicit hover action and sends the complete body to Host. |
| 48 | Pass | **L** A selected Composer range was replaced by the Note body without sending. |
| 49 | Pass | **L** A deliberately disconnected saved Range produced newline append after the existing draft. |
| 50 | Pass | **L** Composer text changed while Send remained untouched. |
| 51 | Pass | **P/V** Pin / Unpin is available in the row overflow menu. |
| 52 | Pass | **P** Pinned Notes sort ahead of every unpinned Note. |
| 53 | Pass | **P** Successful Insert / Edit updates unpinned recency. |
| 54 | Pass | **S/V** Hover has no API call or Product mutation path. |
| 55 | Pass | **V** Pin and Delete live in the low-frequency More menu. |
| 56 | Pass | **P** Note DELETE is immediate and permanent. |
| 57 | Pass | **S/P** The only file-ingest routes require explicit picker paths or dropped `File` objects. |
| 58 | Pass | **P/S** Picker route supports multiple paths; macOS JXA chooser and cancellation are implemented. |
| 59 | Pass | **L** Finder-style real `File` drops resolve through the preload bridge and pin the canonical path. |
| 60 | Pass | **P** Any accessible regular file is accepted independent of MIME allowlists. |
| 61 | Pass | **P** Directory ingestion returns `DIRECTORY_NOT_ALLOWED`. |
| 62 | Pass | **P/S** Database stores path / metadata only; tests verify source bytes directly. |
| 63 | Pass | **P** Canonical path uniqueness returns the existing entry on duplicate pin. |
| 64 | Pass | **P** Newly pinned files appear first. |
| 65 | Pass | **P** Successful call time controls later ordering. |
| 66 | Pass | **V** File row hover exposes Add. |
| 67 | Pass | **L** A Markdown file produced a native chip; a PNG produced the native image preview and Remove control. |
| 68 | Pass | **H/L** Missing native chip falls back to Host Composer insertion of the absolute path. |
| 69 | Pass | **H/S** Host returns `mode: insert-path`; UI reports `Inserted file path`, never attached. |
| 70 | Pass | **L** Both attachment tests left Send untouched and were explicitly cleaned. |
| 71 | Pass | **P/S** Hover has no mutation; `/use` rejects every non-success result. |
| 72 | Pass | **P/V** File-name single click calls the native file-manager adapter with the stored canonical source path; macOS and Windows dispatch are covered. |
| 73 | Pass | **V/S** File name, Add and Delete are separate controls; action buttons do not bubble into file-manager reveal. |
| 74 | Pass | **P/S** Injected reveal tests preserve revision, ordering and source bytes; adapter failures do not mutate product state. |
| 75 | Pass | **S** No inline rename state, rename route or filesystem rename implementation remains. |
| 76 | Pass | **P** Refresh and attempted use remove a confirmed missing reference. |
| 77 | Pass | **S** No directory traversal, inode search or relinking implementation exists. |
| 78 | Pass | **P** Metadata deletion leaves source bytes readable and unchanged. |
| 79 | Pass | **P** File DELETE has no confirmation, Undo or soft-delete state. |
| 80 | Pass | **S** There is no Today’s images collector; PNG appears only through explicit Files ingestion. |
| 81 | Pass | **P** Todo, Notes and Files persist through service restart. |
| 82 | Pass | **S** One configured database and one service are shared across Projects / Threads. |
| 83 | Pass | **P** Two simultaneous SSE clients observe the same authoritative revision stream. |
| 84 | Pass | **P/S** Order, pin, Completed and last-used are persisted fields on that shared stream. File-manager reveal is intentionally outside the mutation stream. |
| 85 | Pass | **L** With port 47832 stopped, RuntimeHost v3, Composer and Images stayed interactive. |
| 86 | Pass | **P/L** Database survived service / client termination; Adapter state is separate from Product data. |
| 87 | Pass | **L/V** Live custom accent / focus / radius / shadow tokens propagated; dark fallback screenshot has valid contrast. |
| 88 | Pass | **L/S** Surface has only its 300px visible rectangle at z-index 40; outside Composer clicks remain live. |
| 89 | Pass | **V** An unsaved Note draft survived an external SSE mutation with the same textarea value. |
| 90 | Pass | **S** Runtime uses loopback HTTP, local SQLite and bundled static files; no account or external network is required. |

## Residual Adapter risk

The product is complete against the current PRD, but the Codex embedding remains an
unsupported Adapter. Toolbar / Tab / Composer selectors and CDP attachment can drift
after a Codex desktop update. Product data and standalone Web UI remain usable when
that happens; repair belongs only in `CodexRuntimeHost`.

The real macOS picker is intentionally not driven by unattended automation because it
opens a user-facing system modal. Its route, multi-path ingestion and cancellation
contract are dependency-injected and Product-tested; Finder drag and both native
attachment outcomes were verified live in the isolated client.
