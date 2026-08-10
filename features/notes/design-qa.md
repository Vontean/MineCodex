# CodexNotes responsive Summary design QA

QA date: 2026-08-08

Reference build: OpenAI Codex Electron `26.803.41515`, Framework
`151.0.7922.76`. Prototype: local CodexNotes through CodexRuntimeHost version 16 in the
isolated profile `/tmp/codexnotes-host2.YaGMKb/codex-profile` on CDP port 9232.

## Comparison evidence

- Native wide pinned: `output/audit/native-summary/02-wide-pinned.png`
- Corrected implementation wide pinned: `output/audit/implementation/11-wide-pinned-corrected.png`
- Same-state wide comparison: `output/audit/implementation/12-wide-corrected-comparison.png`
- Native overlay with right side panel: `output/audit/native-summary/03-overlay-popover-with-side-panel.png`
- Corrected implementation overlay: `output/audit/implementation/09-overlay-with-side-panel-corrected.png`
- Same-state combined comparison: `output/audit/implementation/10-overlay-corrected-comparison.png`
- Native constrained height: `output/audit/native-summary/04-overlay-short-height.png`
- Implementation constrained height: `output/audit/implementation/07-overlay-comparison.png`

The final same-state comparison was opened as one combined image. The implementation
uses the same 300px surface width、25px resolved radius、prominent elevation、14/21
section-title type、16/24 row type、14px section inset、12px section gap and 0.5px
divider rhythm. Overlay placement remains clear of the open native side panel.

The final Add action no longer uses Lucide's 2-unit stroked plus. It uses the filled
20×20 path read from Codex Summary, which resolves to the native optical line weight.
The embedded section title has an explicit `--codex-summary-section-title-font-weight`
token of 400 to compensate for the heavier iframe composite while row text retains the
native 445 weight.

The follow-up live probe forced `:hover` on the native Summary icon button and read
`--color-token-list-hover-background = rgba(13, 13, 13, 0.05)`. CodexNotes now uses
that same token for Section Add and row actions instead of the darker tertiary-button
hover token. The native list wrapper also resolves `mt-0.5` to `2px`; adding the same
Header-to-list margin changes the title-to-first-row geometry from `4.5px` to the
native `6.5px`.

RuntimeHost v16 also normalizes the cloned Notes toolbar button instead of inheriting
whatever native Summary render state happened to exist at clone time. A live isolated
Renderer probe measured a transparent closed background and the native `0.05` list-hover
background for both forced hover and `data-state=open`. Closing with the Notes button or
opening native Summary returned `aria-pressed=false`、`data-state=closed` and a transparent
computed background in both paths.

## Findings

| Priority | Result | Evidence |
| --- | --- | --- |
| P0 | none | Core Summary entry、surface and content remain usable. |
| P1 | none | Responsive presentation、layout shift、collision and constrained height match the reference behavior. |
| P2 | none | Typography、Add icon、color、spacing、radius、shadow and divider mismatches are resolved. |
| P3 | none blocking | The comparison datasets differ, so the implementation is naturally shorter when all three domains are empty. |

Automated verification: CodexNotes 11/11 tests、RuntimeHost 10/10 tests、both syntax
checks and both `git diff --check` runs pass.

final result: passed
