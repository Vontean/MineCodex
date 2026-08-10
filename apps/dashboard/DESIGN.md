# MineCodex Dashboard Design System

## Theme

The control panel is a restrained Codex-native settings surface. It follows system light/dark
appearance, uses one system sans family, and reserves accent color for enabled switches, focus,
and the primary restart action.

## Color

Use semantic OKLCH tokens rather than brand colors:

- Canvas: neutral near-white / near-black.
- Surface: one subtle elevation step from the canvas.
- Ink: high-contrast neutral foreground.
- Secondary and tertiary ink: still meet AA for their text size.
- Border: quiet neutral separator.
- Accent: Codex-like blue used only for action and active state.
- Success and warning: paired with labels or icons, never color alone.

## Typography

Use `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Page title is 20px/600,
plugin names 15px/600, body text 13px/1.5, and compact metadata 12px. No display type,
uppercase tracking, or fluid heading sizes.

## Layout

The page uses a centered 880px content column with a compact header, one restart notice when
needed, a vertical plugin settings group, and a low-emphasis diagnostics footer. At narrow widths
the rows wrap their status and switch controls beneath the copy without horizontal scrolling.

## Components

- Plugin row: icon, name, description, actual-state label, and native checkbox switch.
- Status dot: always accompanied by readable state text.
- Restart notice: inline surface between header and plugin group, not a modal.
- Buttons: one primary restart button and quiet secondary actions with full hover, focus,
  active, disabled, and loading states.
- Loading: skeleton rows preserve layout; errors use an inline retry surface.

## Motion

Use 160–200ms ease-out transitions only for switch position, button feedback, and the restart
notice appearing. Disable nonessential transitions under `prefers-reduced-motion: reduce`.
