# Images: native Library prompt contract

通用视觉、材质、按钮、Tooltip 与原生 sidebar 层级遵循根 [DESIGN.md](../../DESIGN.md)。本文件只记录功能特有组件、布局、数据语义与通用组件选型。

## Scope

Images enhances Codex's native Library image viewer. It does not inject a sidebar
item after Sites, open its own gallery, import image bytes, or replace native
editing/download controls. The previous standalone gallery and local index code
remain available as legacy utilities, but the feature manifest no longer starts
that service or registers that surface.

## Entry and identity

The native `data-testid="viewer-header"` is the entry anchor. The current React
ancestor's Library image record supplies the Library ID, file ID, version and
originating conversation/message IDs. Non-Library viewers and non-image files
are excluded. No title, filename, image position or minified component name is
used as identity. Missing native anchors fail closed.

Resolve the prompt before adding the button. Missing/empty prompts, uploaded
references without generated metadata, inaccessible conversations, and unresolved
native API capabilities all leave the toolbar unchanged. There is no disabled
button, loading placeholder, or empty prompt panel.

The text button is placed immediately before the native percentage/zoom menu and
reuses its live base classes for capsule sizing, colors, border, hover and focus.
Dropdown/zoom variants are excluded: width is max-content, flex is 0 0 auto, and
symmetric inline padding is three native spacing units (12px in this runtime).
The label is Prompt / 提示词, following the native document locale.

## Prompt panel

The panel follows the native Library Version history implementation inspected in
the isolated Codex runtime on 2026-09-27 (`layout` asset, version-history aside):

- `absolute inset-x-2 top-toolbar bottom-2 z-30 ms-auto mt-2 max-w-75`.
- `rounded-2xl border border-default bg-surface shadow-lg`.
- Header: `flex items-center justify-between py-2 ps-4 pe-2`;
  title: `text-base font-semibold text-default`.
- Body: `min-h-0 flex-1 overflow-y-auto px-3`, with one spacing unit of
  top padding (4px). The panel reserves three spacing units below the scroll
  viewport (12px), so scrolling text never meets the rounded bottom edge.
- Prompt: `text-sm leading-5 text-default whitespace-pre-wrap select-text`.

These are native tokens, not a plugin palette or fixed radius. In the inspected
runtime they resolve to 300px width and 20px corners. The close glyph is cloned
from the native viewer control. Long text scrolls inside the panel, remains
selectable, and is rendered with textContent. The header Copy icon button reuses the existing Images Lucide copy/check glyphs
at 16px, with a 32px hit area and an accessible label/tooltip. It writes only the
prompt body to the clipboard and briefly confirms success. No source label or
explanatory metadata appears in the panel. Close and Escape return focus to
the prompt button; Escape does not close the underlying viewer on the same press.

## Data and lifecycle

Read the source conversation through the running renderer's native authenticated
API; discover the API export through Library metadata's actual module imports,
without fixed build hashes. No credentials, signed download URLs or image bytes
are copied or sent to another service.

Match both the originating message and exact image asset pointer, and require
assistant/tool generation metadata. Prefer a recorded generator prompt. Otherwise use only the nearest user ancestor
of that image. Provenance stays internal; the UI simply calls this Prompt / 提示词. Unrelated branches are never used.

Changing images or leaving the viewer aborts the pending lookup and removes the
old UI. Late results cannot mount against a different image. Disabling the feature
removes the observer, keyboard handler, button and panel. Prompt data is retained
only for the current viewer; there is no persistent conversation cache.

The viewer and retained cloud import utility share `src/domain/library-prompt.mjs`. The source factory serializes that pure rule into the viewer script; the cloud adapter serializes the same function into its evaluator call. Whitespace prompts follow the same fallback policy. A valid generated image without prompt text can still be imported by the historical utility, while the viewer shows no prompt control.
