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
| ActionBar | `--color-token-bg-tertiary`, `--shadow-md`, `--elevation-stroke` | 32px pill, 28px controls, centered above the stage |
| Buttons / menus | `--color-text-foreground`, `--color-token-list-hover-background`, `--color-border-focus` | Hover/open/focus are semantic tokens, never literal colors |
| Zoom | `--color-text-foreground-tertiary` | Right aligned; affects only the local stage |
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
