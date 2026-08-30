# Images design contract

## Native token source

Images never owns a light or dark palette. RuntimeHost resolves Codex Renderer
tokens from the live app and sends them as `codex-personal:theme`; `app.js`
applies only those `--color-*`, `--radius-*`, `--shadow-*`, and `--text-*`
variables on the surface root. The editor is intentionally hidden by the host
when the surface identity/token handshake is unavailable, rather than drawing a
look-alike palette.

## Image Details editor

The image stage keeps the existing prompt, metadata, Open Thread, and Save as
areas. Its only added controls are the native-isomorphic floating toolbar:

| Element | Token mapping | Contract |
| --- | --- | --- |
| ActionBar | `--color-surface-tertiary`, `--color-border-subtle`, `--shadow-md` | 32px pill, 2px inset padding, 28px controls, centered inside a 48px sticky gray strip with 8px breathing room above and below; the image editor bounds its sticky lifetime before prompt or metadata content |
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
