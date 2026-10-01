// 复用 Prompts 已验证的原生图标与 Lucide 图标，保持交互一致。
const ICONS = {
  "close": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" aria-hidden=\"true\"><path d=\"M10.962 4.29539C11.1669 4.09057 11.4992 4.09076 11.7042 4.29539C11.9092 4.50039 11.9091 4.83255 11.7042 5.03758L8.74229 7.99949L11.7052 10.9624C11.9097 11.1673 11.9097 11.4996 11.7052 11.7046C11.5003 11.9095 11.168 11.9093 10.963 11.7046L8.0001 8.74168L5.03721 11.7046C4.83216 11.9093 4.49994 11.9095 4.29502 11.7046C4.09047 11.4996 4.09045 11.1673 4.29502 10.9624L7.25791 7.99949L4.296 5.03758C4.09101 4.83255 4.09099 4.5004 4.296 4.29539C4.50105 4.09079 4.8333 4.09054 5.03819 4.29539L8.0001 7.2573L10.962 4.29539Z\" fill=\"currentColor\"/></svg>",
  "back": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" aria-hidden=\"true\"><path d=\"M9.87117 11.6289C10.0762 11.8339 10.0762 12.166 9.87117 12.3711C9.66614 12.5761 9.334 12.5761 9.12898 12.3711L5.36433 8.60641C5.0296 8.27129 5.0296 7.72863 5.36433 7.39351L9.12898 3.62887C9.334 3.42384 9.66614 3.42384 9.87117 3.62887C10.0762 3.83389 10.0762 4.16603 9.87117 4.37105L6.24226 7.99996L9.87117 11.6289Z\" fill=\"currentColor\"/></svg>",
  "chevron": "<!-- @license lucide-static v0.577.0 - ISC -->\n<svg\n  class=\"lucide lucide-chevron-down\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m6 9 6 6 6-6\" />\n</svg>\n",
  "search": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 16 16\" fill=\"none\" aria-hidden=\"true\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M7.32849 1.91016C10.2877 1.91016 12.6867 4.30938 12.6869 7.26855C12.6869 8.57363 12.2192 9.7688 11.4437 10.6982L14.0433 13.2979C14.2481 13.5028 14.2481 13.8351 14.0433 14.04C13.8384 14.245 13.5062 14.2449 13.3011 14.04L10.6957 11.4346C9.77536 12.1793 8.60462 12.627 7.32849 12.627C4.36931 12.6268 1.97009 10.2278 1.97009 7.26855C1.97027 4.30949 4.36942 1.91033 7.32849 1.91016ZM7.32849 2.96094C4.94932 2.96111 3.02105 4.88939 3.02087 7.26855C3.02087 9.64787 4.94921 11.577 7.32849 11.5771C9.70792 11.5771 11.6371 9.64798 11.6371 7.26855C11.6369 4.88928 9.70781 2.96094 7.32849 2.96094Z\" fill=\"currentColor\"/></svg>",
  "check": "<!-- @license lucide-static v0.577.0 - ISC -->\n<svg\n  class=\"lucide lucide-check\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M20 6 9 17l-5-5\" />\n</svg>\n"
};
ICONS.monitor = "<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"1.77\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"20\" height=\"14\" x=\"2\" y=\"3\" rx=\"2\" />\n  <line x1=\"8\" x2=\"16\" y1=\"21\" y2=\"21\" />\n  <line x1=\"12\" x2=\"12\" y1=\"17\" y2=\"21\" />\n</svg>\n";
ICONS.external = "<svg aria-hidden=\"true\" class=\"_Icon_uttcz_1\" focusable=\"false\" height=\"16\" viewBox=\"0 0 16 16\" width=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M11.9489 3.47949C12.0996 3.46465 12.2552 3.51279 12.3707 3.62793C12.4862 3.74328 12.5337 3.89898 12.5192 4.0498C12.5205 4.06633 12.525 4.08275 12.525 4.09961V10.667C12.5249 10.9565 12.2901 11.191 12.0006 11.1914C11.7108 11.1914 11.4754 10.9568 11.4752 10.667V5.2666L4.37172 12.376C4.16672 12.5807 3.83352 12.5808 3.62855 12.376C3.42373 12.1711 3.42384 11.8388 3.62855 11.6338L10.733 4.52539H5.33363C5.04368 4.52539 4.80824 4.28995 4.80824 4C4.80824 3.71005 5.04368 3.47461 5.33363 3.47461H11.9C11.9165 3.47462 11.9327 3.47822 11.9489 3.47949Z\" fill=\"currentColor\"></path></svg>";
ICONS.globe = "<svg width=\"20\" height=\"20\" viewBox=\"0 0 20 20\" fill=\"currentColor\" xmlns=\"http://www.w3.org/2000/svg\" class=\"icon-xs shrink-0\" aria-hidden=\"true\"><path d=\"M10 2.125C14.3492 2.125 17.875 5.65076 17.875 10C17.875 14.3492 14.3492 17.875 10 17.875C5.65076 17.875 2.125 14.3492 2.125 10C2.125 5.65076 5.65076 2.125 10 2.125ZM7.88672 10.625C7.94334 12.3161 8.22547 13.8134 8.63965 14.9053C8.87263 15.5194 9.1351 15.9733 9.39453 16.2627C9.65437 16.5524 9.86039 16.625 10 16.625C10.1396 16.625 10.3456 16.5524 10.6055 16.2627C10.8649 15.9733 11.1274 15.5194 11.3604 14.9053C11.7745 13.8134 12.0567 12.3161 12.1133 10.625H7.88672ZM3.40527 10.625C3.65313 13.2734 5.45957 15.4667 7.89844 16.2822C7.7409 15.997 7.5977 15.6834 7.4707 15.3486C6.99415 14.0923 6.69362 12.439 6.63672 10.625H3.40527ZM13.3633 10.625C13.3064 12.439 13.0059 14.0923 12.5293 15.3486C12.4022 15.6836 12.2582 15.9969 12.1006 16.2822C14.5399 15.467 16.3468 13.2737 16.5947 10.625H13.3633ZM12.1006 3.7168C12.2584 4.00235 12.4021 4.31613 12.5293 4.65137C13.0059 5.90775 13.3064 7.56102 13.3633 9.375H16.5947C16.3468 6.72615 14.54 4.53199 12.1006 3.7168ZM10 3.375C9.86039 3.375 9.65437 3.44756 9.39453 3.7373C9.1351 4.02672 8.87263 4.48057 8.63965 5.09473C8.22547 6.18664 7.94334 7.68388 7.88672 9.375H12.1133C12.0567 7.68388 11.7745 6.18664 11.3604 5.09473C11.1274 4.48057 10.8649 4.02672 10.6055 3.7373C10.3456 3.44756 10.1396 3.375 10 3.375ZM7.89844 3.7168C5.45942 4.53222 3.65314 6.72647 3.40527 9.375H6.63672C6.69362 7.56102 6.99415 5.90775 7.4707 4.65137C7.59781 4.31629 7.74073 4.00224 7.89844 3.7168Z\"></path></svg>";
ICONS.edit = "<svg aria-hidden=\"false\" class=\"shrink-0 opacity-75 group-focus:opacity-100 group-hover:opacity-100\" height=\"16\" viewBox=\"0 0 16 16\" width=\"16\" xmlns=\"http://www.w3.org/2000/svg\"><path fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M9.41506 2.54535C10.5566 1.516 12.2884 1.57105 13.3399 2.64105C14.4597 3.72222 14.4959 5.5405 13.3467 6.68988L7.75588 12.2797C7.18583 12.8809 6.45561 13.2881 5.6924 13.4653H5.69045L2.59767 14.1762L2.5967 14.1743C2.4644 14.2058 2.19674 14.2328 1.98342 14.02C1.76937 13.8062 1.79632 13.5371 1.82814 13.4047L2.5381 10.3188C2.71723 9.5224 3.12639 8.8269 3.68752 8.26703L9.30568 2.64887L9.41506 2.54535ZM4.4297 9.01019C3.99658 9.44234 3.69398 9.96492 3.56252 10.5512L3.56154 10.5541L2.99513 13.0063L5.45607 12.4418C6.02206 12.3102 6.56957 12.0068 6.99513 11.558L7.00392 11.5483L11.5254 7.02582L8.96877 4.46918L4.4297 9.01019ZM12.5986 3.38422C11.9258 2.69135 10.7787 2.66298 10.0479 3.39203L10.0469 3.39105L9.71193 3.72602L12.2686 6.28266L12.6045 5.94769C13.3406 5.21146 13.3067 4.06829 12.6113 3.39691L12.5986 3.38422Z\" fill=\"currentColor\"></path></svg>";
ICONS.remove = "<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"1.575\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M10 11v6\" />\n  <path d=\"M14 11v6\" />\n  <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\" />\n  <path d=\"M3 6h18\" />\n  <path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\" />\n</svg>\n";
const MENU_CLASSES = {"menu": "no-drag z-50 m-px flex select-none flex-col overflow-y-auto bg-surface-elevated-secondary/90 text-default ring-border ring-[0.5px] shadow-xl-spread backdrop-blur-sm rounded-2xl p-[var(--app-menu-gutter,var(--spacing))] min-w-[var(--app-menu-min-width,220px)]", "item": "no-drag outline-hidden flex min-h-[var(--app-menu-item-height,0px)] shrink-0 items-center justify-center p-[var(--app-menu-item-padding,var(--padding-row-y)_var(--padding-row-x))] text-(length:--app-menu-item-font-size,var(--text-sm)) leading-(--app-menu-item-line-height,var(--text-sm--line-height)) rounded-xl text-default group hover:bg-primary-ghost-hover focus:bg-primary-ghost-hover cursor-interaction flex flex-col", "row": "flex w-full min-w-0 items-center gap-[var(--spacing-menu-item-content,calc(var(--spacing)*1.5))]", "leading": "_leadingIcon_ml6jk_2"};
const text = (en, zh) => (document.documentElement.lang || navigator.language).startsWith("zh") ? zh : en;
const host = payload => config.requestHostAction("sites", payload);
const owned = "data-mcx-sites";
let disposed = false, state = { sites: [], projects: [], threads: [] }, addButton, rowsRoot, fallback, dialog, menu;
let rowSignature = "", nativeButton, nativeInner, nativePlus, nativeSiteIcon, nativeMore, timer, revision = 0, opening = false;
let addedTab, addedOnly = false, nativeExternal, nativeGlobe, nativeActionsClass, tabClasses;
let currentPage, refreshAt = 0, pendingLayout = null;
const style = document.createElement("style");
style.setAttribute(owned, "style");
style.textContent = `
[data-mcx-sites=rows] {display:contents}
[data-mcx-sites] .mcx-site-preview,[data-mcx-sites] .mcx-site-candidate-art {position:relative}
[data-mcx-sites] .mcx-site-preview::after,[data-mcx-sites] .mcx-site-candidate-art::after {content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 1px var(--color-border)}
[data-mcx-sites] .mcx-site-preview.mcx-site-placeholder,[data-mcx-sites] .mcx-site-candidate-art.mcx-site-placeholder {background:var(--color-background-primary-soft);color:var(--color-text-primary)}
.mcx-site-thumbnail {display:block;width:100%;height:100%;object-fit:cover;object-position:top;border-radius:inherit}
[data-mcx-sites] .mcx-site-skeleton {width:100%;height:100%;flex:none;border-radius:inherit;--loading-results-shimmer-base:color-mix(in srgb,var(--color-text-primary) 6%,var(--color-surface));--loading-results-shimmer-highlight:color-mix(in srgb,var(--color-text-primary) 16%,var(--color-surface));background-color:var(--loading-results-shimmer-base);background-image:linear-gradient(105deg,transparent 30%,var(--loading-results-shimmer-highlight) 48%,transparent 66%);background-repeat:no-repeat;background-size:240% 100%;animation:mcx-site-shimmer 1.6s ease-in-out infinite}
[data-mcx-sites] .mcx-site-preview>.mcx-site-skeleton,[data-mcx-sites] .mcx-site-candidate-art>.mcx-site-skeleton {position:absolute;inset:0}
@keyframes mcx-site-shimmer {from {background-position:150% 0} to {background-position:-150% 0}}
@media(prefers-reduced-motion:reduce) {[data-mcx-sites] .mcx-site-skeleton {animation:none}}
:root[data-reduced-motion=true] [data-mcx-sites] .mcx-site-skeleton {animation:none}
[data-mcx-sites=grid] {display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px}
[data-mcx-sites=table] {display:grid;grid-template-columns:minmax(0,1fr) minmax(120px,160px) auto}
[data-mcx-sites=entry] {color:var(--color-text-primary);font-family:var(--font-sans-default)}
[data-mcx-sites=entry] .mcx-site-preview {display:flex;align-items:center;justify-content:center;background:var(--color-surface-elevated-secondary);color:var(--color-text-tertiary)}
[data-mcx-sites=entry] .mcx-site-preview svg {width:24px;height:24px}
[data-mcx-sites=entry] .mcx-site-meta {font-size:var(--text-sm);color:var(--color-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-mcx-sites=entry] .mcx-site-name {overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--text-base)}
[data-mcx-sites=entry] .mcx-site-menu {position:relative;z-index:2}
[data-mcx-sites=dialog] {margin:auto;width:min(560px,calc(100vw - 40px));max-height:calc(95vh - 40px);overflow:auto}
[data-mcx-sites=dialog][open] {display:flex;flex-direction:column}
[data-mcx-sites=dialog] .mcx-site-content {padding:0;min-height:0;overflow:auto}
[data-mcx-sites=dialog] [role=tabpanel],[data-mcx-sites=dialog] form {min-height:0;display:flex;flex-direction:column}
[data-mcx-sites=dialog] h3 {font-size:var(--text-sm);font-weight:var(--font-weight-medium);color:var(--color-text-secondary);margin:20px 0 6px}
[data-mcx-sites=dialog] p {color:var(--color-text-secondary);font-size:var(--text-sm);margin:6px 0 16px}
[data-mcx-sites=dialog] .mcx-site-candidate {padding:12px 0;border-bottom:1px solid var(--color-border)}
[data-mcx-sites=dialog] .mcx-site-candidate>div {min-width:0}
[data-mcx-sites=dialog] .mcx-site-url {color:var(--color-text-secondary);font-size:var(--text-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-mcx-sites=dialog] label {display:block;margin:14px 0 6px;font-size:var(--text-sm);font-weight:var(--font-weight-medium)}
[data-mcx-sites=dialog] input {box-sizing:border-box;width:100%;min-height:36px;padding:8px 12px;border:1px solid var(--color-border-primary-outline);border-radius:var(--control-radius-md);background:transparent;color:var(--color-text-primary);outline:none;font:inherit}
[data-mcx-sites=dialog] input:focus-visible {border-color:var(--color-ring);outline:none}
[data-mcx-sites=dialog] [role=alert] {color:var(--color-text-danger);font-size:var(--text-sm);margin-top:12px}
[data-mcx-sites=menu] {position:fixed;z-index:1000;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);outline:none}
[data-mcx-sites=menu] button {width:100%;border:0;text-align:start;font-family:var(--font-sans-default)}
[data-mcx-sites=menu] svg {width:16px;height:16px;opacity:.75}
[data-mcx-sites=menu] button:hover svg,[data-mcx-sites=menu] button:focus svg {opacity:1}
[data-mcx-sites=notice] {position:fixed;bottom:24px;left:50%;transform:translateX(-50%);max-width:min(560px,90vw);z-index:1000;padding:12px 16px;border:1px solid var(--color-border);border-radius:var(--radius-xl);background:var(--color-surface-elevated);color:var(--color-text-primary);box-shadow:var(--shadow-xl-spread);font:var(--text-sm)/1.5 var(--font-sans-default)}
[data-mcx-sites-empty-suppressed],[data-mcx-sites-native-hidden] {display:none!important}
[data-mcx-sites=entry] .mcx-site-sharing svg {width:16px;height:16px;flex:none}
@container (max-width:520px) {[data-mcx-sites=table] {grid-template-columns:minmax(0,1fr) auto}}

[data-mcx-sites=dialog] .mcx-site-icon {display:flex;align-items:center;justify-content:center;width:28px;height:28px;flex:none;border:0;border-radius:var(--radius-full);padding:0;background:transparent;color:var(--color-text-secondary)}
[data-mcx-sites=dialog] .mcx-site-icon svg {width:16px;height:16px}
[data-mcx-sites=dialog] .mcx-site-icon:hover {background:var(--color-background-primary-ghost-hover);color:var(--color-text-primary)}
[data-mcx-sites=dialog] .mcx-site-results {max-height:340px;min-height:100px;overflow:auto;margin:0 -8px}
[data-mcx-sites=dialog] .mcx-site-results h3 {margin:12px 8px 4px;color:var(--color-text-tertiary);font-weight:500}
[data-mcx-sites=dialog] .mcx-site-candidate {width:100%;padding:10px 8px;border:0;background:transparent;border-radius:var(--radius-lg);color:var(--color-text-primary);text-align:start;font:inherit}
[data-mcx-sites=dialog] .mcx-site-candidate:hover:not(:disabled),[data-mcx-sites=dialog] .mcx-site-candidate:focus-visible {background:var(--color-background-primary-ghost-hover)}
[data-mcx-sites=dialog] .mcx-site-candidate .mcx-site-candidate-info {flex:1;min-width:0}
[data-mcx-sites=dialog] label.mcx-site-candidate {margin:0;font-size:inherit;font-weight:inherit;cursor:pointer}
[data-mcx-sites=dialog] .mcx-site-candidate:has(input:disabled) {cursor:default}
[data-mcx-sites=dialog] .mcx-site-candidate input.mcx-site-checkbox {appearance:auto;flex:none;width:16px;height:16px;min-height:0;margin:0;padding:0;accent-color:var(--color-text-primary)}
[data-mcx-sites=dialog] .mcx-site-candidate input.mcx-site-checkbox:focus-visible {outline:2px solid var(--color-ring);outline-offset:2px}
[data-mcx-sites=dialog] .mcx-site-candidate .mcx-site-candidate-info>div {white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
[data-mcx-sites=dialog] .mcx-site-candidate>svg {width:16px;height:16px;flex:none;color:var(--color-text-secondary)}
[data-mcx-sites=dialog] .mcx-site-candidate-art {width:96px;height:60px;overflow:hidden;display:flex;align-items:center;justify-content:center;flex:none;background:var(--color-background-primary-soft);border-radius:var(--radius-md);color:var(--color-text-secondary)}
[data-mcx-sites=dialog] .mcx-site-candidate-art svg {width:20px;height:20px}
[data-mcx-sites=dialog] .mcx-site-modes {display:flex;align-items:center;gap:var(--segmented-control-gap);padding:var(--segmented-control-gutter);flex-shrink:0;margin:0 0 16px;border-radius:var(--control-radius-md);background:var(--color-background-secondary-solid)}
[data-mcx-sites=dialog] .mcx-site-mode {flex:1;min-width:0;height:var(--control-size-md);padding:0 var(--control-gutter-md);border:0;border-radius:calc(var(--control-radius-md) - var(--segmented-control-gutter));background:transparent;color:var(--color-text-secondary);font-family:inherit;font-size:var(--control-font-size-md);font-weight:var(--segmented-control-font-weight);line-height:1.5;white-space:nowrap}
[data-mcx-sites=dialog] .mcx-site-mode[aria-selected=false] {color:var(--color-text-secondary-solid)}
[data-mcx-sites=dialog] .mcx-site-mode[aria-selected=false]:hover {background:var(--color-background-secondary-solid-hover)}
[data-mcx-sites=dialog] .mcx-site-mode[aria-selected=false]:active {background:var(--color-background-secondary-solid-active)}
[data-mcx-sites=dialog] .mcx-site-mode[aria-selected=true] {background:var(--segmented-control-thumb-background);box-shadow:var(--segmented-control-thumb-shadow);color:var(--color-text-primary)}
[data-mcx-sites=dialog] .mcx-site-mode:focus-visible {outline:2px solid var(--color-ring);outline-offset:-2px}
[data-mcx-sites=dialog] [role=tabpanel][hidden] {display:none}
[data-mcx-sites=dialog] form .mcx-site-content>label:first-child {margin-top:0}
[data-mcx-sites=dialog] .mcx-site-scan-row {display:flex;align-items:center;gap:12px;padding:10px 8px}
[data-mcx-sites=dialog] .mcx-site-scan-copy {flex:1;display:flex;flex-direction:column;gap:10px}
[data-mcx-sites=dialog] .mcx-site-scan-copy .mcx-site-skeleton {height:12px;border-radius:var(--radius-sm)}
[data-mcx-sites=dialog] .mcx-site-scan-copy .mcx-site-skeleton:last-child {width:32%;height:10px}
[data-mcx-sites=dialog] .mcx-site-scan-row:nth-child(2) .mcx-site-skeleton {animation-delay:-.3s}
[data-mcx-sites=dialog] .mcx-site-scan-row:nth-child(3) .mcx-site-skeleton {animation-delay:-.6s}
[data-mcx-sites=dialog] .mcx-site-empty {padding:28px 16px;text-align:center;color:var(--color-text-secondary);font-size:var(--text-sm)}
`;
document.head.append(style);
function element(tag, className, content) { const e = document.createElement(tag); if (className) e.className = className; if (content != null) e.textContent = content; return e; }
function icon(name) { return new DOMParser().parseFromString(ICONS[name], "image/svg+xml").documentElement.cloneNode(true); }
function iconButton(label, name, action) { const b = element("button", "mcx-site-icon"); b.type = "button"; b.setAttribute("aria-label", label); b.setAttribute("data-minecodex-tooltip", label); b.append(icon(name)); b.onclick = action; return b; }
function nativeProps(node, predicate) {
  let fiber = node?.[Object.keys(node).find(k => k.startsWith("__reactFiber"))];
  for (let depth = 0; fiber && depth < 220; depth++, fiber = fiber.return) { const p = fiber.memoizedProps; if (p && predicate(p)) return p; }
  return null;
}
function router() {
  const p = nativeProps(document.querySelector("[data-sidebar-destination]"), p => p.router?.navigate || p.value?.router?.navigate);
  return p?.router || p?.value?.router;
}
function visible(e) { return !!e?.isConnected && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0; }
function button(label, action, primary = false) {
  const b = element("button", nativeButton || ""); b.type = "button";
  b.dataset.color = primary ? "primary" : "secondary"; b.dataset.variant = primary ? "solid" : "outline"; b.dataset.size = "lg"; b.dataset.pill = "";
  b.append(element("span", nativeInner || "", label)); b.addEventListener("click", action); return b;
}
function dialogButton(label, action, primary = false) {
  const b = config.ui.action(element("button", "", label), primary ? "primary" : "secondary");
  b.type = "button"; b.addEventListener("click", action); return b;
}
function setButtonDisabled(button, disabled) {
  button.disabled = disabled; button.setAttribute("aria-disabled", String(disabled)); button.toggleAttribute("data-disabled", disabled);
}
function notice(message) {
  document.querySelector(`[${owned}=notice]`)?.remove();
  const n = element("div", "", message); n.setAttribute(owned, "notice"); n.setAttribute("role", "status"); document.body.append(n);
  setTimeout(() => n.remove(), 7000);
}
async function refresh() {
  const data = await host({ operation: "list" });
  if (disposed) return; state = data; revision++; rowSignature = ""; refreshAt = Date.now(); schedule();
}
function pageInfo() {
  if (router()?.state?.location?.pathname !== "/space/sites") return null;
  const input = [...document.querySelectorAll("input")].find(e => /Search sites|搜索站点|搜尋網站/.test(e.placeholder));
  if (!input) return null;
  let page = input.parentElement;
  while (page && !page.classList.contains("min-h-full")) page = page.parentElement;
  if (!page || page.children.length < 2) return null;
  const content = page.children[1], list = page.querySelector('[data-testid="sites-table"], [data-testid="sites-grid"]');
  const native = nativeProps(list || content.querySelector("button") || content.querySelector("p") || content.lastElementChild?.lastElementChild, p => "viewMode" in p && "shared" in p);
  const grid = native ? native.viewMode === "grid" : !!page.querySelector('button[aria-label="Grid view"][aria-pressed="true"],button[aria-label="网格视图"][aria-pressed="true"]');
  const shared = native ? !!native.shared : [...page.querySelectorAll("button[aria-pressed=true]")].some(b => /Shared with you|与你共享|與你共用/.test(b.textContent));
  const create = [...page.firstElementChild.querySelectorAll("button")].find(b => /^(New|新建|新增)$/.test(b.textContent.trim()) && !b.hasAttribute(owned));
  return { page, input, content, list, grid, shared, create };
}
function cacheNative(page) {
  const create = page.create;
  if (create) {
    const template = page.page.querySelector('button[data-size="lg"][data-color="secondary"]');
    nativeButton = template.className; nativeInner = template.firstElementChild.className;
    nativePlus = create.querySelector("svg")?.cloneNode(true);
  }
  nativeSiteIcon ||= document.querySelector('[data-sidebar-destination="builtin:sites"] svg')?.cloneNode(true);
  const row = page.list?.querySelector("[data-appgen-row], article");
  nativeExternal ||= row?.querySelector('button[aria-label*="new tab"]')?.cloneNode(true);
  nativeActionsClass ||= row?.lastElementChild?.className;
  nativeGlobe ||= [...(page.list?.querySelectorAll("[data-appgen-row]") || [])].find(r => r.children[2]?.textContent.includes("Everyone"))?.children[2]?.querySelector("svg")?.cloneNode(true);
  nativeMore ||= row?.querySelector('button[aria-haspopup="menu"] svg')?.cloneNode(true);
}
function closeMenu() { const previous = menu?.trigger; previous?.setAttribute("aria-expanded", "false"); previous?.setAttribute("data-state", "closed"); menu?.node.remove(); menu = null; previous?.focus({ preventScroll: true }); }
function showMenu(trigger, site) {
  closeMenu();
  const m = element("div", MENU_CLASSES.menu); config.ui.surface(m); m.setAttribute(owned, "menu"); m.setAttribute("role", "menu"); m.tabIndex = -1;
  function menuItem(label, glyph) {
    const item = element("button", MENU_CLASSES.item); item.type = "button"; item.setAttribute("role", "menuitem"); item.tabIndex = -1;
    const row = element("div", MENU_CLASSES.row), leading = element("span", MENU_CLASSES.leading), svg = icon(glyph); svg.setAttribute("aria-hidden", "true");
    leading.append(svg); row.append(leading, element("span", "flex-1 min-w-0 truncate", label)); item.append(row); return item;
  }
  const edit = menuItem(text("Edit", "编辑"), "edit"); edit.onclick = () => { closeMenu(); showEditor(site); };
  const remove = menuItem(text("Remove", "移除"), "remove");
  remove.onclick = async () => { closeMenu(); try { await host({ operation: "remove", id: site.id }); await refresh(); } catch (e) { notice(e.message); } };
  if (site.origin.kind === "external") m.append(edit); m.append(remove); document.body.append(m); const r = trigger.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + "px";
  m.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8)) + "px";
  menu = { node: m, trigger }; trigger.setAttribute("aria-expanded", "true"); trigger.setAttribute("data-state", "open"); m.focus();
  m.addEventListener("keydown", e => { if (["ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); const items = [...m.children]; const current = items.indexOf(document.activeElement); items[current < 0 ? (e.key === "ArrowUp" ? items.length - 1 : 0) : (current + (e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length].focus(); } });
}
function siteSecondary(site) {
  const projectId = site.projectId || site.origin?.projectId;
  const project = site.projectName || state.projects.find(p => p.id === projectId)?.name;
  if (project) {
    const port = site.status === "running" && site.url ? new URL(site.url).port : "";
    return port ? `${project}（${port}）` : project;
  }
  return site.url ? new URL(site.url).host : text("Not started", "未启动");
}
async function startProjectSite(id) {
  notice(text("Starting website…", "正在启动网站…"));
  for (let attempt = 0; attempt < 40 && !disposed; attempt++) {
    const result = await host({ operation: "start", id }); if (!result.pending) return result.url;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(text("Website startup timed out.", "网站启动超时。"));
}
const previewRequests = new Map();
function loadPreview(container, url, cachedOnly = false) {
  container.classList.remove("mcx-site-placeholder"); container.setAttribute("aria-busy", "true");
  const skeleton = element("div", "mcx-site-skeleton"); skeleton.setAttribute("aria-hidden", "true"); container.replaceChildren(skeleton);
  const placeholder = () => { container.classList.add("mcx-site-placeholder"); container.removeAttribute("aria-busy"); container.replaceChildren(); if (nativeSiteIcon) container.append(nativeSiteIcon.cloneNode(true)); };
  const key = cachedOnly ? `cached:${url}` : url;
  let request = previewRequests.get(key);
  if (!request) {
    request = (async () => {
      for (let attempt = 0; attempt < 60 && !disposed; attempt++) {
        const result = await host({ operation: "preview", url, cachedOnly });
        if (!result.pending) return result;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      return { image: null };
    })().catch(() => ({ image: null })); previewRequests.set(key, request);
    request.then(result => { if (!result.image) previewRequests.delete(key); });
  }
  request.then(({ image }) => {
    if (disposed || !container.isConnected) return;
    if (!image) { placeholder(); return; }
    const img = element("img"); img.alt = ""; img.className = "mcx-site-thumbnail";
    img.onload = () => { if (!disposed && container.isConnected) { container.removeAttribute("aria-busy"); container.replaceChildren(img); } };
    img.onerror = placeholder; img.src = image;
  });
}
function row(site, grid) {
  const r = element("div", grid ? "group/site-card relative grid h-[210px] min-w-0 grid-rows-[148px_62px] overflow-hidden rounded-2xl border border-subtle bg-surface-card shadow-sm" : "relative col-span-full grid min-h-[82px] grid-cols-subgrid items-center overflow-hidden rounded-xl px-4 py-4 select-none hover:bg-primary-ghost-hover");
  r.setAttribute(owned, "entry"); r.dataset.siteId = site.id;
  const open = element("button", "absolute inset-0 cursor-interaction rounded-xl bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset");
  open.type = "button"; open.setAttribute("aria-label", text("Open ", "打开 ") + site.title); open.onclick = () => openSite(site); r.append(open);
  const preview = element("div", "mcx-site-preview " + (grid ? "pointer-events-none" : "relative h-[50px] w-20 shrink-0 overflow-hidden rounded-[6px]"));
  if (nativeSiteIcon) preview.append(nativeSiteIcon.cloneNode(true));
  if (site.url) loadPreview(preview, site.url, site.status === "stopped"); else preview.classList.add("mcx-site-placeholder");
  const info = element("div", grid ? "pointer-events-none relative z-10 flex min-w-0 items-center gap-3 px-4" : "pointer-events-none relative z-10 flex min-w-0 items-center gap-4");
  const names = element("div", "min-w-0 flex-1"); names.append(element("div", "mcx-site-name", site.title), element("div", "mcx-site-meta", siteSecondary(site)));
  if (!grid) info.append(preview); info.append(names);
  const more = button(text("Site options", "站点选项"), () => showMenu(more, site));
  more.classList.add("mcx-site-menu", "justify-self-end"); more.dataset.variant = "ghost"; more.dataset.uniform = ""; more.style.pointerEvents = "auto"; more.setAttribute("aria-label", text("Options for ", "站点选项：") + site.title); more.setAttribute("aria-haspopup", "menu");
  more.firstElementChild.replaceChildren(); if (nativeMore) more.firstElementChild.append(nativeMore.cloneNode(true)); else more.firstElementChild.textContent = "⋯";
  const actions = element("div", nativeActionsClass || "relative z-10 flex items-center gap-2 justify-end ps-4");
  if (grid) actions.className = "pointer-events-auto relative z-10 flex items-center gap-2";
  {
    const external = nativeExternal ? nativeExternal.cloneNode(true) : button("", () => {});
    if (!nativeExternal) { external.dataset.variant = "ghost"; external.dataset.uniform = ""; external.dataset.iconSize = "sm"; external.firstElementChild.replaceChildren(icon("external")); } external.setAttribute("aria-label", text("Open in default browser: ", "在默认浏览器打开：") + site.title);
    external.onclick = async e => {
      e.stopPropagation();
      try {
        if (!window.electronBridge?.sendMessageFromView) throw new Error(text("Native browser opening is unavailable.", "原生浏览器打开通道暂不可用。"));
        const resolved = await host({ operation: "resolve", id: site.id });
        if (resolved.missing) throw new Error(text("The original project is unavailable.", "原项目已不可用。"));
        const url = resolved.site.entryId && resolved.site.status !== "running" ? await startProjectSite(site.id) : resolved.site.url;
        await window.electronBridge.sendMessageFromView({ type: "open-in-browser", url, initiator: "sites_library", openTarget: "external-browser", disposition: "new-tab", source: "manual" });
      } catch (error) { notice(error.message); }
    };
    actions.append(external);
  }
  actions.append(more);
  if (grid) { info.append(actions); r.append(preview, info); }
  else {
    const sharing = element("div", "mcx-site-sharing pointer-events-none relative z-10 flex min-w-0 items-center gap-1.5 ps-4 text-sm leading-5 text-default [@container_(max-width:520px)]:sr-only");
    const glyph = site.hosting === "local" ? icon("monitor") : (nativeGlobe?.cloneNode(true) || icon("globe"));
    if (glyph) { glyph.setAttribute("aria-hidden", "true"); sharing.append(glyph); }
    sharing.append(element("span", "truncate", site.hosting === "local" ? text("Local address", "本机地址") : text("External site", "外部站点")));
    r.append(info, sharing, actions);
  }
  return r;
}
function updateAddedTab(page) {
  const group = page.page.querySelector('[aria-label="Site ownership"]');
  if (!group) return;
  const tabs = [...group.querySelectorAll("button")].filter(b => !b.hasAttribute(owned));
  if (tabs.length !== 2) return;
  if (!tabClasses) tabClasses = { active: tabs.find(b => b.getAttribute("aria-pressed") === "true")?.className, inactive: tabs.find(b => b.getAttribute("aria-pressed") === "false")?.className };
  if (!addedTab?.isConnected) {
    addedTab = tabs[1].cloneNode(false); addedTab.setAttribute(owned, "added-tab"); addedTab.textContent = text("Added by you", "由你添加");
    addedTab.onclick = () => { addedOnly = true; rowSignature = ""; reconcile(); }; group.append(addedTab);
  }
  tabs.forEach((tab, i) => {
    const selected = !addedOnly && (i === (page.shared ? 1 : 0));
    const cls = selected ? tabClasses.active : tabClasses.inactive;
    if (tab.className !== cls) tab.className = cls;
    if (tab.getAttribute("aria-pressed") !== String(selected)) tab.setAttribute("aria-pressed", String(selected));
  });
  addedTab.className = addedOnly ? tabClasses.active : tabClasses.inactive;
  addedTab.setAttribute("aria-pressed", String(addedOnly));
  page.list?.querySelectorAll("[data-appgen-row], article").forEach(r => r.toggleAttribute("data-mcx-sites-native-hidden", addedOnly));
}
function reconcile() {
  if (disposed) return;
  const page = pageInfo();
  if (!page) { addedOnly = false; addedTab?.remove(); addedTab = null; addButton?.remove(); addButton = null; rowsRoot?.remove(); rowsRoot = null; fallback?.remove(); fallback = null; rowSignature = ""; currentPage = null; closeMenu(); return; }
  cacheNative(page); updateAddedTab(page);
  if (currentPage !== page.page) { currentPage = page.page; rowSignature = ""; if (Date.now() - refreshAt > 1500) refresh().catch(e => notice(e.message)); }
  if (!addButton?.isConnected && page.create) {
    addButton = button(text("Add site", "添加站点"), () => showDiscovery()); addButton.setAttribute(owned, "add");
    if (nativePlus) addButton.firstElementChild.prepend(nativePlus.cloneNode(true));
    page.create.before(addButton);
  }
  const query = page.input.value.trim().toLowerCase();
  const sites = !addedOnly ? [] : state.sites.filter(s => [s.title, s.url || "", state.projects.find(p => p.id === s.origin.projectId)?.name || ""].some(v => v.toLowerCase().includes(query)));
  const signature = JSON.stringify([revision, query, page.shared, page.grid, addedOnly]);
  if (signature === rowSignature && rowsRoot?.isConnected && (page.list ? rowsRoot.parentElement === page.list : fallback?.isConnected)) return;
  rowsRoot?.remove(); fallback?.remove(); fallback = null;
  document.querySelectorAll("[data-mcx-sites-empty-suppressed]").forEach(e => e.removeAttribute("data-mcx-sites-empty-suppressed"));
  rowsRoot = element("div"); rowsRoot.setAttribute(owned, "rows"); rowSignature = signature;
  if (!sites.length && !addedOnly) { rowsRoot = null; return; }
  if (addedOnly && !page.list && page.content.firstElementChild) page.content.firstElementChild.setAttribute("data-mcx-sites-empty-suppressed", "");
  if (page.list) page.list.append(rowsRoot);
  else {
    fallback = element("div", "@container pb-3"); fallback.setAttribute(owned, "fallback");
    const layout = element("div"); layout.setAttribute(owned, page.grid ? "grid" : "table"); fallback.append(layout); layout.append(rowsRoot);
    if (page.content.firstElementChild) page.content.firstElementChild.setAttribute("data-mcx-sites-empty-suppressed", "");
    page.content.append(fallback);
  }
  rowsRoot.append(...sites.map(s => row(s, page.grid)));
  if (addedOnly && !sites.length) { const empty = element("div", "col-span-full py-8 text-center text-sm text-secondary", text("No added sites", "暂无添加的站点")); rowsRoot.append(empty); }
}
function schedule() { clearTimeout(timer); timer = setTimeout(reconcile, 60); }
function newDialog(title, back) {
  dialog?.close(); dialog?.remove(); closeMenu();
  const previous = document.activeElement; const d = element("dialog"); d.setAttribute(owned, "dialog"); d.setAttribute("aria-labelledby", "mcx-sites-dialog-title");
  const heading = config.ui.heading(d, { title, closeLabel:text("Close", "关闭"), onClose:()=>d.close(),
    back:back ? iconButton(text("Back", "返回"), "back", back) : null });
  heading.querySelector("h2").id = "mcx-sites-dialog-title";
  document.body.append(d); dialog = d;
  d.addEventListener("close", () => { d.remove(); if (dialog === d) dialog = null; previous?.focus({ preventScroll: true }); });
  d.addEventListener("click", e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } });
  d.showModal(); return d;
}
async function showDiscovery() {
  const d = newDialog(text("Add site", "添加站点"));
  const tabs = element("div", "mcx-site-modes"); tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", text("Add site method", "添加方式"));
  const modes = [
    { id: "projects", label: text("Project", "项目") },
    { id: "url", label: text("Custom", "自定义") }
  ].map(mode => {
    const tab = element("button", "mcx-site-mode", mode.label), panel = element("div"); tab.type = "button";
    tab.id = `mcx-site-tab-${mode.id}`; panel.id = `mcx-site-panel-${mode.id}`;
    tab.setAttribute("role", "tab"); tab.setAttribute("aria-controls", panel.id);
    panel.setAttribute("role", "tabpanel"); panel.setAttribute("aria-labelledby", tab.id);
    tabs.append(tab); return { tab, panel };
  });
  d.append(tabs, ...modes.map(mode => mode.panel));
  function select(index) {
    d.dispatchEvent(new Event("mcx-sites-mode-change"));
    modes.forEach(({ tab, panel }, i) => { const active = i === index; tab.setAttribute("aria-selected", String(active)); tab.tabIndex = active ? 0 : -1; panel.hidden = !active; });
  }
  modes.forEach(({ tab }, index) => {
    tab.onclick = () => select(index);
    tab.onkeydown = e => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault(); const next = e.key === "Home" ? 0 : e.key === "End" ? modes.length - 1 : (index + (e.key === "ArrowRight" ? 1 : -1) + modes.length) % modes.length;
      select(next); modes[next].tab.focus();
    };
  });
  select(0); mountEditor(d, modes[1].panel);
  await mountDiscovery(d, modes[0].panel);
}
async function mountDiscovery(d, panel) {
  const content = element("div", "mcx-site-content"); panel.append(content);
  const results = element("div", "mcx-site-results"); results.setAttribute("aria-live", "polite"); content.append(results);
  const error = element("div"); error.setAttribute("role", "alert"); content.append(error);
  let candidates = [], loaded = false, saving = false;
  const selected = new Set(), completed = new Set();
  const footer = config.ui.footer(element("div", "mcx-site-footer"));
  const cancel = dialogButton(text("Cancel", "取消"), () => d.close());
  const add = dialogButton(text("Add", "添加"), async () => {
    if (saving || !selected.size) return;
    saving = true; error.textContent = ""; render();
    try {
      // 逐项保存，失败时保留尚未完成的选择，避免重复提交成功项。
      for (const candidate of [...selected]) {
        await host({ operation: "save", site: { ...candidate, origin: { kind: "project", projectId: candidate.projectId } } });
        completed.add(candidate); selected.delete(candidate);
      }
      await refresh(); d.close();
    } catch (e) { error.textContent = e.message; }
    finally { saving = false; if (d.isConnected) render(); }
  }, true);
  footer.append(cancel, add); panel.append(footer);
  function updateActions() { setButtonDisabled(add, saving || !selected.size); setButtonDisabled(cancel, saving); }
  function render() {
    updateActions(); results.replaceChildren();
    results.setAttribute("aria-busy", String(!loaded));
    if (!loaded) {
      results.append(element("span", "sr-only", text("Looking for websites…", "正在查找网页…")));
      ["64%", "48%", "58%"].forEach(width => {
        const row = element("div", "mcx-site-scan-row"); row.setAttribute("aria-hidden", "true");
        const art = element("div", "mcx-site-candidate-art"); art.append(element("div", "mcx-site-skeleton"));
        const copy = element("div", "mcx-site-scan-copy"), title = element("div", "mcx-site-skeleton"); title.style.width = width;
        copy.append(title, element("div", "mcx-site-skeleton")); row.append(art, copy); results.append(row);
      });
      return;
    }
    if (!candidates.length) results.append(element("div", "mcx-site-empty", text("No project websites found", "尚未发现项目网页")));
    for (const candidate of candidates) {
      const item = element("label", "mcx-site-candidate");
      const art = element("span", "mcx-site-candidate-art"); if (nativeSiteIcon) art.append(nativeSiteIcon.cloneNode(true));
      const info = element("div", "mcx-site-candidate-info"); info.append(element("div", "", candidate.title), element("div", "mcx-site-url", siteSecondary(candidate)));
      const added = completed.has(candidate) || state.sites.some(s => (candidate.entryId && s.entryId === candidate.entryId || candidate.url && s.url === candidate.url) && s.origin.projectId === candidate.projectId);
      const checkbox = element("input", "mcx-site-checkbox"); checkbox.type = "checkbox";
      checkbox.checked = added || selected.has(candidate); checkbox.disabled = added || saving;
      checkbox.setAttribute("aria-label", (added ? text("Added: ", "已添加：") : "") + candidate.title);
      checkbox.onchange = () => { if (checkbox.checked) selected.add(candidate); else selected.delete(candidate); updateActions(); };
      item.append(art, info, checkbox); if (candidate.url) loadPreview(art, candidate.url, candidate.status !== "running"); else art.classList.add("mcx-site-placeholder");
      results.append(item);
    }
  }
  async function load() {
    loaded = false; render(); error.textContent = "";
    try { await refresh(); const data = await host({ operation: "discover" }); if (!d.isConnected) return; candidates = data.candidates; }
    catch { error.textContent = text("Couldn't find services. Reopen this dialog to try again.", "暂时无法发现服务，请重新打开弹窗重试。"); }
    finally { loaded = true; if (d.isConnected) render(); }
  }
  await load();
}
function showEditor(site, problem) {
  const d = newDialog(text("Edit site", "编辑站点"));
  mountEditor(d, d, site, problem).focus();
}
function mountEditor(d, container, site, problem) {
  const form = element("form"), content = element("div", "mcx-site-content"); form.append(content); container.append(form);
  function field(label, key, value, type) { const l = element("label", "", label), i = element("input"); i.id = `mcx-site-${key}`; l.htmlFor = i.id; i.name = key; i.value = value || ""; i.type = type || "text"; content.append(l, i); return i; }
  const url = field(text("URL", "网址"), "url", site?.url, "url"); url.required = true; url.placeholder = "http://localhost:3000";
  const title = field(text("Name", "名称"), "title", site?.title); title.maxLength = 160; title.required = true;
  let origin = site?.origin || { kind: "external" };
  const error = element("div", "", problem); error.setAttribute("role", "alert"); content.append(error);
  const footer = config.ui.footer(element("div", "mcx-site-footer")); const cancel = dialogButton(text("Cancel", "取消"), () => d.close()); const save = dialogButton(site ? text("Save", "保存") : text("Add", "添加"), () => {}, true); save.type = "submit"; footer.append(cancel, save); form.append(footer);
  let submitting = false;
  function validFields() {
    if (!title.value.trim() || title.value.trim().length > 160 || !url.value.trim() || !url.validity.valid) return false;
    try { const parsed = new URL(url.value.trim()); return ["http:", "https:"].includes(parsed.protocol) && !!parsed.hostname && !parsed.username && !parsed.password; }
    catch { return false; }
  }
  function updateSave() { setButtonDisabled(save, submitting || !validFields()); }
  form.addEventListener("input", updateSave); form.addEventListener("change", updateSave); updateSave();
  form.onsubmit = async e => {
    e.preventDefault(); if (submitting || !validFields()) { updateSave(); return; }
    submitting = true; updateSave(); error.textContent = "";
    try { await host({ operation: "save", id: site?.id, site: { title: title.value.trim(), url: url.value.trim(), origin } }); await refresh(); d.close(); }
    catch (e) { error.textContent = e.message; }
    finally { submitting = false; updateSave(); }
  };
  return url;
}
async function until(check, milliseconds = 7000) {
  const end = Date.now() + milliseconds;
  while (!disposed && Date.now() < end) { const value = check(); if (value) return value; await new Promise(r => setTimeout(r, 80)); }
  throw new Error(text("The native view did not become ready. Please try again.", "原生视图未就绪，请重试。"));
}
function composerId() { return [...document.querySelectorAll('[data-codex-composer="true"]')].filter(visible).map(e => e.closest("[data-codex-composer-root]")?.querySelector("[data-above-composer-conversation-id]")?.getAttribute("data-above-composer-conversation-id")).find(Boolean); }
function fullViewControl(enter) {
  const pattern = enter ? /^(Enter full view|进入完整视图|进入全屏视图|進入完整檢視|進入全螢幕檢視)$/ : /^(Exit full view|退出完整视图|退出全屏视图|退出完整檢視|退出全螢幕檢視)$/;
  return [...document.querySelectorAll("button")].find(e => visible(e) && [e.getAttribute("aria-label"), e.getAttribute("title"), e.getAttribute("data-tooltip-content")].some(value => pattern.test(value || "")));
}
async function applyWebLayout(token) {
  try {
    await until(() => pendingLayout !== token || (router()?.state?.location?.pathname !== "/space/sites" && (fullViewControl(true) || fullViewControl(false))));
    if (pendingLayout !== token) return;
    const hide = [...document.querySelectorAll("button")].find(e => visible(e) && /^(Hide sidebar|隐藏侧栏|隐藏侧边栏|隱藏側邊欄|收起侧栏)$/.test(e.getAttribute("aria-label") || "")); hide?.click();
    // 使用原生完整视图入口，保留原生网页标签和底部聊天输入框。
    fullViewControl(true)?.click();
  } catch (e) { if (pendingLayout === token && !disposed) notice(e.message); }
  finally { if (pendingLayout === token) pendingLayout = null; }
}
async function openSite(site) {
  if (opening) return; opening = true;
  try {
    const resolved = await host({ operation: "resolve", id: site.id });
    if (!resolved.missing && resolved.site.entryId && resolved.site.status !== "running") {
      resolved.site.url = await startProjectSite(site.id); resolved.site.status = "running"; await refresh();
    }
    if (resolved.missing) { await refresh(); notice(text("The original project or chat is unavailable. Remove this entry and add it again from an available project.", "原项目或聊天已不可用，请移除此条目后从可用项目重新添加。")); return; }
    const r = router(); if (!r) throw new Error(text("Native navigation is unavailable.", "原生导航暂不可用。"));
    const origin = resolved.site.origin;
    if (origin.kind === "thread") {
      await r.navigate(`/local/${origin.threadId}`);
      await until(() => composerId() === origin.threadId);
    } else {
      const nonce = Date.now();
      // 项目网页必须进入本地执行草稿，普通聊天模式会丢弃项目上下文。
      await r.navigate("/", { state: {
        project: origin.kind === "project" ? { type: "local", projectId: origin.projectId } : null,
        ...(origin.kind === "project" ? { prefillLocalExecution: true, prefillComposerMode: "local" } : {}),
        focusComposerNonce: nonce
      } });
      await until(() => r.state.location.pathname === "/" && [...document.querySelectorAll('[data-codex-composer="true"]')].some(e => visible(e) && nativeProps(e, p => p.value?.kind === "new" && p.value.focusComposerNonce === nonce)));
      // 等原生草稿的 layout/effect 完成，浏览器再绑定到当前草稿。
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    // 只在同一原聊天中复用网址相同的原生 tab，项目新草稿仍走新建路径。
    const existing = origin.kind === "thread" && [...document.querySelectorAll('[role="tab"]')].find(e => {
      const p = nativeProps(e, p => p.tab?.kind === "browser");
      return p?.tab.props?.browserConversationId === origin.threadId && p.tab.durableRoute?.params?.restoreUrl === resolved.site.url;
    });
    if (existing) existing.click();
    else window.postMessage({ type: "open-browser-tab", ...(origin.kind === "thread" ? { conversationId: origin.threadId } : {}), initialUrl: resolved.site.url, ...(origin.kind === "project" ? { cwd: resolved.cwd } : {}), source: "manual", initiator: "sites_library" }, location.origin);
    const token = {}; pendingLayout = token; await applyWebLayout(token);
  } catch (e) { notice(e.message); }
  finally { opening = false; }
}
function onClick(e) {
  if (addedOnly && e.target.closest('[aria-label="Site ownership"] button:not([data-mcx-sites])')) { addedOnly = false; rowSignature = ""; schedule(); }
  if (menu && !menu.node.contains(e.target) && !menu.trigger.contains(e.target)) closeMenu();
  if (e.target.closest(`[${owned}]`)) return;
  const row = e.target.closest("[data-appgen-row], [data-testid=sites-grid] > article");
  if (!row || !pageInfo()) return;
  const b = e.target.closest("button");
  // 只跟随官方打开动作；分享、菜单和 Create 不触发布局变化。
  if (b && !b.hasAttribute("aria-haspopup") && /^(Edit |Open |编辑|打开)/.test(b.getAttribute("aria-label") || "")) {
    const token = {}; pendingLayout = token; void applyWebLayout(token);
  }
}
function onKey(e) { if (e.key === "Escape" && menu) { e.preventDefault(); closeMenu(); } else if (e.key === "Tab" && menu) closeMenu(); }
function onPointer(e) { if (e.target.closest('[role="separator"]')) pendingLayout = null; }
const observer = new MutationObserver(records => { if (records.some(r => !r.target.closest?.(`[${owned}]`))) schedule(); });
observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
document.addEventListener("input", schedule); document.addEventListener("click", onClick, true); document.addEventListener("keydown", onKey, true); document.addEventListener("pointerdown", onPointer, true);
refresh().catch(e => notice(e.message)); schedule();
return () => {
  disposed = true; pendingLayout = null; clearTimeout(timer); observer.disconnect();
  document.removeEventListener("input", schedule); document.removeEventListener("click", onClick, true); document.removeEventListener("keydown", onKey, true); document.removeEventListener("pointerdown", onPointer, true);
  addedOnly = false; const page = pageInfo(); if (page) updateAddedTab(page);
  document.querySelectorAll("[data-mcx-sites-native-hidden]").forEach(e => e.removeAttribute("data-mcx-sites-native-hidden"));
  closeMenu(); dialog?.close(); document.querySelectorAll(`[${owned}]`).forEach(e => e.remove());
  document.querySelectorAll("[data-mcx-sites-empty-suppressed]").forEach(e => e.removeAttribute("data-mcx-sites-empty-suppressed"));
};
