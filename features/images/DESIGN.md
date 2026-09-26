# Images design contract

## Native token source

Images never owns a light or dark palette. RuntimeHost resolves Codex Renderer
tokens from the live app and sends them as `codex-personal:theme`; `app.js`
applies only those `--color-*`, `--radius-*`, `--shadow-*`, and `--text-*`
variables on the surface root. The editor is intentionally hidden by the host
when the surface identity/token handshake is unavailable, rather than drawing a
look-alike palette.

## Page header

The library follows the image-first rhythm of ChatGPT Library: a 72px title
row containing the source filter, compact column selector, grouping, and refresh.
There is no divider above the gallery.
The title is 26px; source selection is a 36px transparent dropdown trigger, with a neutral
background only on hover or while expanded. Existing source,
refresh, density, and grouping controls retain their behavior.

When Codex's native left sidebar is hidden, the Images title row exposes the
native sidebar glyph at its leading edge. RuntimeHost owns sidebar state and the
native click; the iframe only mirrors availability, visibility, and the native
localized accessible label. Its 28px hit area, 16px rendered glyph, and leading
position mirror the live native trigger so it clears the macOS traffic lights in
windowed mode. The control disappears again when the sidebar opens.

## Gallery and detail composition

Layout tokens live in `web/styles.css`: `--library-gutter` is 20–56px,
`--library-card-radius` is 16px, `--library-detail-gutter` is 20–40px, and
`--library-card-shadow` uses neutral black shadows selected by the active color scheme.
ChatGPT Library measured on 2026-09-26 uses 16px card corners and a
0 4px 16px shadow at 5% black, together with a 1px border at 5% black.
Cards use that combination: the faint border defines light image edges while
the single broad shadow provides soft depth. Do not compensate with a heavier
contact shadow. Dark mode uses the native subtle border and 16% black shadow.
The library canvas mixes 1.2% foreground
into the native surface to provide the subtle backdrop seen in Library. Gallery spacing is 16px in both directions, matching the measured Library grid.
Grid images with aspect ratio at least 2:1 use 7% black shadow (20% in dark mode)
to compensate for their smaller height; blur and offset remain unchanged.
Grouped cards retain the standard shadow.
The default is four columns; saved user choices remain honored and narrow
containers still reduce to two or one. All images is the first control in the right-aligned toolbar. Source and column
triggers share 13px normal-weight muted text. Column count uses a custom listbox
matching the source menu, including selected state, arrow navigation and Escape.
The gallery has no top padding, including the thumbnail rail and narrow layout.
The column listbox is 76px wide. The source menu uses 16px corners, 6px inset, and 36px rows with 10px corners. Images retain their intrinsic aspect ratios in the
existing masonry layout, without a permanent caption strip. Source/date
captions appear inside the image on hover or keyboard focus; touch devices show
them persistently. Accessible image names continue to include source and date.
Grouped cards retain visible titles and source metadata.

Image Details retains the thumbnail rail and full-width mobile drawer. Its
transparent image stage is inset from the page edges, without an extra padded
canvas or minimum height. Images keep natural proportions using auto width and
height within the existing size limits, with prompt and
metadata aligned beneath it. Only the metadata section and fixed action footer
use dividers. Footer actions are 34px pills in a 56px row with 10px vertical padding. The Close glyph aligns with the image stage edge using a 14px offset that compensates for its hit area and internal SVG whitespace. At widths of 520px and below,
gutters and card radii reduce to 16px and headers to 60px. Theme colors remain
semantic; this composition does not introduce a separate light/dark palette.

## Image Details editor

The image stage keeps the existing prompt, metadata, Open Thread, and Save as
areas. Its only added controls are the native-isomorphic floating toolbar:

| Element | Token mapping | Contract |
| --- | --- | --- |
| ActionBar | `--color-surface-tertiary`, `--color-border-subtle`, `--shadow-md` | 32px pill, 2px inset padding, 28px controls, centered inside a 48px transparent sticky strip with 8px breathing room above and below; the image editor bounds its sticky lifetime before prompt or metadata content |
| Buttons / menus | `--color-text-foreground`, `--color-background-primary-ghost-hover`, `--color-border-focus` | Native source SVGs render at 16px (Comment/Remove/ratios) and 18px (Resize); hover/open/focus use semantic tokens |
| Menus | `--color-surface-elevated-secondary`, `--color-border`, `--shadow-xl` | Resize is 160px; Zoom is 136px with 6px padding and 10px radius |
| Zoom | `--color-text-foreground-tertiary` | Right aligned; shows the measured fit percentage and preserves the native check-mark menu |
| Active edit mode | `--color-chart-blue`, `--color-text-inverse` | Native SVG Cancel and Undo/Redo controls; history controls remain hidden until a stroke exists |
| Comment draft / edit | `--color-text-accent`, `--color-surface-elevated-secondary` | New drafts use the 30px marker and 294×44 input; the input flips to the marker's left when the right edge lacks room, so it never covers the spatial anchor. Empty Enter keeps the draft editor active, while Escape or leaving the surface discards it. Committed comments reopen in the native 294×120 editor with Delete, Cancel, and Save; empty edits disable Save rather than deleting implicitly |
| Comment markers / brush preview | `--color-text-accent`, `--color-text-on-accent` | Position and size remain expressed in source-image coordinates |

At narrow widths action labels collapse to their existing icon controls; their
accessible names remain stable. Menus close on outside click and Escape. Escape
inside an open comment input closes only that input. Cancel drops the current
comment/remove session and returns to the closed toolbar.

## Editing and send boundary

Comment produces the original image plus an annotated PNG. Remove produces the
original image plus a black PNG mask with white strokes. Resize sends only the
original image and its selected ratio instruction. The loopback Images server
creates bounded temporary auxiliary PNGs and returns a one-shot draft ID; the
only privileged operation is the allowlisted `create-image-edit-thread` action.
RuntimeHost exchanges that ID directly with Images, verifies regular absolute
files, opens a fresh native Chat, attaches the source and optional
auxiliary image, inserts the instruction, and clicks the native Send control.
It never changes the source Thread or creates a Project task. On a failure the
surface retains the current editing state and announces the error.

## Embedded boundary and pointer interaction

When the host reports an open sidebar, Images draws a 1px semantic border at
its left edge without consuming layout width. The line hides with the sidebar.
The refresh icon aligns optically with the gallery right edge: its 36px hit
area extends 10px beyond its 16px glyph, with scrollbar width accounted for.
The Images iframe explicitly uses `-webkit-app-region: no-drag` to exclude the
native 46px draggable titlebar beneath it. Header buttons, the column select,
and the source menu also opt out of dragging.

Host theme observation includes `data-theme` as well as class and style changes,
so embedded surfaces update when the current client switches appearance.

The source filter panel reserves an 8px bottom inset outside its scrolling
content, so partially visible rows do not touch the rounded panel edge.

RuntimeHost resolves canonical theme tokens by semantic name: existing names
take priority, followed by the equivalent `--app-color-*` namespace and explicit
historical aliases in `codex-design-contract.mjs`. It never guesses by build
hash or fuzzy matching. Missing editor tokens are reported once per changed
missing-token set, so a future incompatible contract is diagnosable.
Prompt indexing parses JavaScript syntax without executing it. It supports static
strings, templates, concatenation, and store/load references, including explicitly
echoed historical command output with recorded string transformations. Truncated
or unsupported expressions stay unresolved. It also follows exec-to-wait cell IDs;
images without a recorded result path retain the missing-prompt state.

## Cloud Library sync

On entering Images, cached images render first. The existing Refresh control
stays busy while local scanning and paginated cloud Library synchronization run.
New or changed generated images are cached as originals; unchanged Library
versions skip downloads. The current feed and pagination retain their image snapshot
while new images accumulate. A 36px pill floats 12px below the content area's top,
centered horizontally, showing an up arrow and the number of new images in the
current filter. Clicking applies the latest snapshot and scrolls to the top
(smoothly unless reduced motion is requested). Background polling also uses this
flow. The pill is hidden while viewing details or a thread; changing filters or
view mode starts a fresh snapshot. Cached images remain browsable during sync.
Per-image failures leave the cache intact and are reported in the Refresh tooltip
and live status; another refresh retries failed items. No cloud deletion is mirrored.

RuntimeHost uses the current native account session. Asset filenames and minified
exports are discovered from the running app's module references and Library
capabilities rather than pinned build hashes. Authentication remains in the
native renderer. Only listed images with an exact source-message/file match and
explicit generation metadata are imported; uploaded references are excluded.
The cache keeps Library identity/version separately from image identity.

A recorded generator prompt is labeled Generation prompt. When unavailable, the
nearest user message on that image's actual ancestry is labeled Original request.
A missing conversation fails that item without inventing metadata. Local prompt
recovery likewise applies general syntax/record association rules to all images,
not a hard-coded image ID.
