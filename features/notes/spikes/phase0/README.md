# Phase 0 — Codex Host Adapter evidence

Verified against an isolated Codex profile over CDP on 2026-08-08. These are
Adapter implementation facts, not public Codex contracts.

## Toolbar and pinned summary

- Native toolbar anchor: `button[aria-label="Toggle summary"]`.
- Native pressed/open state is reflected through `aria-pressed`,
  `aria-expanded`, and `data-state`.
- Native summary surface marker:
  `[data-pip-home-surface="thread-summary-panel-popover"]`.
- Opening Sources or the pinned summary is mutually exclusive at the surface
  level. Switching thread closes the native summary.
- The native summary is 300px wide and uses flat, divided sections with
  `thread-summary-panel-item-button` rows.

## Right-side workspace tabs

- Right tab strip marker: `[data-app-shell-tab-strip-controller="right"]`.
- Tabs and panels use `data-app-shell-tab-controller="right"` and
  `data-app-shell-tab-panel-controller="right"`, keyed by `data-tab-id`.
- Native close controls use `data-app-shell-tab-close-button="true"`.

These selectors are intentionally isolated inside the Codex Host Adapter.

## Composer text insertion

- Composer marker: `[data-codex-composer="true"][contenteditable="true"]`.
- A Range plus `document.execCommand("insertText", false, text)` inserts at the
  current selection/caret and does not send the message.
- The Adapter must focus the composer and fall back to newline append only when
  the current selection is not inside it.

## Native file attachment

`native-file-drop-probe.mjs` proves that a known absolute path can become a
native Codex Composer attachment without copying the file or sending a message:

1. Create a temporary hidden file input in the Codex document.
2. Populate it with `DOM.setFileInputFiles` over CDP.
3. Dispatch `dragenter`, `dragover`, and `drop` with its real `File` objects to
   the Codex Composer.
4. Verify the native filename chip and its `Remove <filename>` control.
5. Remove the probe attachment unless `--keep` is passed.

The native **Files and folders** command appears to be backed by an Electron or
macOS chooser rather than a renderer-owned `<input type="file">`; therefore
`Page.fileChooserOpened` is not a reliable Adapter seam.

Run the repeatable proof against an isolated profile:

```sh
node spikes/phase0/native-file-drop-probe.mjs --port 9231 --file PRD.md
```

## Internal command strings

The current app bundle contains `togglePinnedSummary` and `composer.addFiles`.
They are useful orientation evidence only and are not used as public contracts.
