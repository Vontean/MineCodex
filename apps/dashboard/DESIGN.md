# MineCodex Dashboard Design System

The standalone control panel follows the root DESIGN.md semantic color and interaction
contract. It uses local light/dark tokens. In an official MCP App panel, the initial appearance follows
the host theme and tracks host changes; a manual appearance choice retains precedence.
The browser and MCP panel share the same dashboard source, controls and state semantics.

## Layout and reference

Reference: VPN Dashboard settings source, inspected 2026-10-03. Its card grid uses a 16px
radius/gap, top icon and trailing arrow, followed by a title and description. The live URL
required login; this reference is source-based, not a live visual match.

MineCodex uses one centered 1064px column without a sidebar or category groups. The header
holds the shared brand, a Chinese / English language selector to the left of the appearance control, and the appearance control; a runtime notice appears below only when the service needs attention.
There is no tagline or visible section introduction. Save feedback remains available to screen readers.
Eight independent cards form a three-column grid, two columns at 960px and one at 600px.
Each card has an icon and switch at the top, name and purpose below, and a readable actual-state line
at the bottom of every card. Enabled switches and runtime state remain distinct information. A card is not itself clickable. The footer shows the MineCodex version
and adjacent update check (16px gap, regular weight, refresh icon), with persistent update feedback below it. An optional Copy diagnostics action exports only capability and token evidence; no install path, account data or session content is shown.

Self-check states distinguish checking, available, partially available across windows, missing appearance tokens, unavailable and not applicable on this page. Installation evidence does not certify full user actions. Visible cards refresh while the page is visible; active setting saves are preserved.

## Tokens and components

- Canvas: cool #edf1f7 / deep blue #101722, with a decorative ASCII voxel world.
- Surface: white / #1b2533, with a hard 3px lower edge for a block-like silhouette; no blur.
- Border: #d7dfe9 / #334359; blue #3478d4 / #71a8f3 switches and active state accents.
- Ink, secondary ink, accent, success, warning and danger use the local semantic CSS tokens.
- `--card-radius`: 8px; `--grid-gap`: 16px; `--card-padding`: 24px.
- Card minimum height: 216px desktop, 204px mobile; content can grow without clipping.
- System sans family; pixel brand title 36–64px/700, feature name 16px/600, description 14px/1.65,
  state metadata 13px/1.5. Each description is one short statement of purpose; remove promotional filler while preserving each feature’s actual state.
- Feature icons: 24px display size, uniform 2.1-unit stroke in a 24×24 viewBox, matching Prompts. The control-server normalizes only dashboard output; original injected assets stay unchanged.
- Icons: existing manifest assets, with official Lucide bell, panel-left and globe for
  Task Switcher, Sidebar Focus and Sites. Lucide ISC license is retained in
  `packages/ui/assets/lucide-LICENSE.txt`.
- Checkbox switches expose switch semantics, feature labels, descriptions and state text.
  Track is 36×21px with a 32px-high label hit area. Pending requests disable only their switch;
  failures restore the previous value and focus. Enabled and active remain distinct facts.
- Language uses a compact 中文 / EN capsule with aria-pressed. It follows the browser initially; manual choices persist locally and reload localized card content. Switching is disabled during feature saves. Healthy and injected share the same visible Active in Codex label; backend health remains diagnostic data.
- Appearance uses the VPN reference’s two-segment sun/moon capsule (32px segments, 4px gap and padding). A sliding selected circle and aria-pressed expose selection. Browser entry follows the system and persists manual choices locally. The official App initially follows Codex, allows a temporary manual choice, and follows the next explicit host theme change. Its full-height content surface owns the dashboard palette because the official sandbox overrides html/body backgrounds.
- Restart and error notices use a neutral card, colored left edge, status icon, compact copy and trailing action; toast errors share that material. Restart notice appears only for a pending restart. No automatic restart.
- Update checks retain loading, result and retryable failure states; installation stays with
  the existing `mcx update` flow.

## Motion

`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`. Switch thumb: 180ms transform;
button press: 140ms transform to scale(0.97). No stagger, card lift, layout motion or continuous
loading shimmer. Hover is limited to fine pointers. Keyboard actions disable transitions;
reduced-motion preferences disable movement. Focus rings remain visible in both themes.

## Project identity

The masthead uses self-hosted Silkscreen Bold (SIL OFL, bundled license in assets/OFL.txt),
with a stone-colored face, dark outline and stepped text shadow inspired by Minecraft lettering.
The shared pickaxe mark is 76px desktop / 48px mobile. Body and state text retain the legible
project sans-serif contract. This is a dashboard-specific visual treatment; the brand geometry
and other injected plugin UI remain governed by root DESIGN.md.

Dashboard icons are official Lucide SVGs, covered by packages/ui/assets/lucide-LICENSE.txt.
All font and icon assets are served locally and included in the npm package.

## ASCII agent world

A fixed, pointer-transparent and aria-hidden canvas renders deterministic terraced terrain,
ASCII water, paths and coding nodes (>_, {}, git, </>, [AI], $). It rotates around its vertical
axis once every 240 seconds, rendered at at most 20 fps and device pixel ratio capped at 2.
The world stays behind opaque cards; text and controls never rotate. Reduced motion freezes
the view, hidden tabs pause the animation. The terrain module has no external dependency
or network request and does not consume user or session data.

## Data transfer

The footer includes a quiet Transfer data action. A native modal dialog (520px maximum,
24px padding, existing opaque surface and 8px radius) shows only portable features as bordered
cards. Feature-specific explanations live behind a small info button. The native auto popover
uses the shared `installFeatureTooltips().tooltipSurface` material through `/assets/ui-tooltip.js`,
with local theme token mapping only; its geometry, keyboard activation and Escape remain
owned by this click-triggered hint. No separate tooltip material lives in dashboard CSS.
Close uses the shared Dialog SVG, centered as a 16px block inside a 32px flex hit area.
Non-portable features and generic file/platform explanations are omitted from this dialog.
The merge policy is one 11px tertiary line, without a filled notice surface. Export and Import
are equal outline surface buttons, each with an official Lucide icon and a text label. Labels
can change for confirmation/retry without replacing the icons. Empty status text takes no space.
Selecting a file shows added/duplicate/conflict counts before confirmation. Busy states prevent
duplicate submissions and closing; native dialog focus restoration is preserved.

Footer version label and value align on their text baseline. Source previously stretched
14px normal-line-height Chinese and numeric text boxes; 2026-10-05 preview measurements showed
1px difference in text top. Baseline alignment matches both text tops and the neighboring actions
without a positional offset.

Feature names describe user tasks rather than implementation details. Chinese and English descriptions state a concrete benefit in one sentence and avoid claims beyond the feature. Markdown Reader and Cascading File Browser default on; explicit saved opt-outs remain unchanged. File navigation uses its own full card with a folder icon.

卡片顺序：模型窗口、提示词库、额度环、会话状态、Markdown 阅读增强、文件级联浏览、图片集合、站点收藏、侧栏聚焦、隐藏额度推广。API 统一输出此顺序；不改变 Runtime 的加载顺序。
