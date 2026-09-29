const ICONS = {
  prompt:
    '<svg\n  class="lucide lucide-book-open"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="-1.5 -1.5 27 27"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="1.5"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path vector-effect="non-scaling-stroke" d="M12 7v14" />\n  <path vector-effect="non-scaling-stroke" d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />\n</svg>',
  chevron:
    '<!-- @license lucide-static v0.577.0 - ISC -->\n<svg\n  class="lucide lucide-chevron-down"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="m6 9 6 6 6-6" />\n</svg>\n',
  search:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.32849 1.91016C10.2877 1.91016 12.6867 4.30938 12.6869 7.26855C12.6869 8.57363 12.2192 9.7688 11.4437 10.6982L14.0433 13.2979C14.2481 13.5028 14.2481 13.8351 14.0433 14.04C13.8384 14.245 13.5062 14.2449 13.3011 14.04L10.6957 11.4346C9.77536 12.1793 8.60462 12.627 7.32849 12.627C4.36931 12.6268 1.97009 10.2278 1.97009 7.26855C1.97027 4.30949 4.36942 1.91033 7.32849 1.91016ZM7.32849 2.96094C4.94932 2.96111 3.02105 4.88939 3.02087 7.26855C3.02087 9.64787 4.94921 11.577 7.32849 11.5771C9.70792 11.5771 11.6371 9.64798 11.6371 7.26855C11.6369 4.88928 9.70781 2.96094 7.32849 2.96094Z" fill="currentColor"/></svg>',
  "arrow-down-wide-narrow":
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.66722 3.14218C4.95711 3.14225 5.19261 3.37767 5.19261 3.66757V11.6295L6.95824 9.82578C7.16093 9.61896 7.49327 9.61573 7.70043 9.81796C7.90753 10.0208 7.91092 10.353 7.70824 10.5602L5.27953 13.0406L5.2141 13.1012C4.89729 13.3642 4.43507 13.3645 4.1184 13.1012L4.05297 13.0406L1.62523 10.5602C1.4228 10.353 1.42608 10.0207 1.63304 9.81796C1.8401 9.61558 2.17245 9.61912 2.37523 9.82578L4.14183 11.6295V3.66757C4.14183 3.37762 4.37727 3.14218 4.66722 3.14218Z" fill="currentColor"/> <path d="M10.7854 2.98203C11.1021 2.71876 11.5643 2.719 11.8811 2.98203L11.9465 3.04257L14.3752 5.52304C14.5779 5.73021 14.5745 6.06242 14.3674 6.26523C14.1603 6.46786 13.828 6.46437 13.6252 6.25742L11.8586 4.45175V12.3336C11.8584 12.6233 11.623 12.859 11.3332 12.859C11.0436 12.8588 10.8081 12.6232 10.8078 12.3336V4.45371L9.04222 6.25742C8.83948 6.46447 8.50723 6.46775 8.30004 6.26523C8.093 6.06236 8.08941 5.73017 8.29222 5.52304L10.72 3.04257L10.7854 2.98203Z" fill="currentColor"/></svg>',
  check:
    '<!-- @license lucide-static v0.577.0 - ISC -->\n<svg\n  class="lucide lucide-check"\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M20 6 9 17l-5-5" />\n</svg>\n',
  x: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10.962 4.29539C11.1669 4.09057 11.4992 4.09076 11.7042 4.29539C11.9092 4.50039 11.9091 4.83255 11.7042 5.03758L8.74229 7.99949L11.7052 10.9624C11.9097 11.1673 11.9097 11.4996 11.7052 11.7046C11.5003 11.9095 11.168 11.9093 10.963 11.7046L8.0001 8.74168L5.03721 11.7046C4.83216 11.9093 4.49994 11.9095 4.29502 11.7046C4.09047 11.4996 4.09045 11.1673 4.29502 10.9624L7.25791 7.99949L4.296 5.03758C4.09101 4.83255 4.09099 4.5004 4.296 4.29539C4.50105 4.09079 4.8333 4.09054 5.03819 4.29539L8.0001 7.2573L10.962 4.29539Z" fill="currentColor"/></svg>',
  back: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9.87117 11.6289C10.0762 11.8339 10.0762 12.166 9.87117 12.3711C9.66614 12.5761 9.334 12.5761 9.12898 12.3711L5.36433 8.60641C5.0296 8.27129 5.0296 7.72863 5.36433 7.39351L9.12898 3.62887C9.334 3.42384 9.66614 3.42384 9.87117 3.62887C10.0762 3.83389 10.0762 4.16603 9.87117 4.37105L6.24226 7.99996L9.87117 11.6289Z" fill="currentColor"/></svg>',
  settings:
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M6.33374 8.97461C7.54786 8.97484 8.56163 9.83236 8.80347 10.9746H13.3337C13.6235 10.9749 13.8591 11.2102 13.8591 11.5C13.8591 11.7898 13.6235 12.0251 13.3337 12.0254H8.80347C8.56163 13.1676 7.54786 14.0252 6.33374 14.0254C5.11907 14.0254 4.10455 13.1673 3.86304 12.0244L2.66675 12.0254C2.37691 12.0253 2.14138 11.7899 2.14136 11.5C2.14136 11.2102 2.37693 10.9748 2.66675 10.9746H3.86304C4.10491 9.83221 5.11941 8.97461 6.33374 8.97461ZM6.33374 10.0254C5.51912 10.0254 4.85913 10.6854 4.85913 11.5C4.85913 12.3146 5.51912 12.9746 6.33374 12.9746C7.14814 12.9743 7.80835 12.3145 7.80835 11.5C7.80835 10.6855 7.14814 10.0257 6.33374 10.0254Z" fill="currentColor"/> <path fill-rule="evenodd" clip-rule="evenodd" d="M9.66675 1.97461C10.881 1.97461 11.8935 2.83236 12.1355 3.97461H13.3328C13.6227 3.97459 13.8581 4.21005 13.8582 4.5C13.8581 4.78993 13.6227 5.02537 13.3328 5.02539H12.1365C11.8946 6.16774 10.881 7.02539 9.66675 7.02539C8.45245 7.02539 7.43893 6.16774 7.19702 5.02539H2.66675C2.3768 5.02539 2.14136 4.78995 2.14136 4.5C2.14136 4.21005 2.3768 3.97461 2.66675 3.97461H7.19702C7.43893 2.83226 8.45245 1.97461 9.66675 1.97461ZM9.66675 3.02539C8.85213 3.02539 8.19214 3.68538 8.19214 4.5C8.19214 5.31462 8.85213 5.97461 9.66675 5.97461C10.4814 5.97461 11.1414 5.31462 11.1414 4.5C11.1414 3.68538 10.4814 3.02539 9.66675 3.02539Z" fill="currentColor"/></svg>',
  drag: '<svg\n  xmlns="http://www.w3.org/2000/svg"\n  width="24"\n  height="24"\n  viewBox="0 0 24 24"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="2"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M4 5h16" />\n  <path d="M4 12h16" />\n  <path d="M4 19h16" />\n</svg>\n',
  "prompt-nav":
    '<svg\n  class="lucide lucide-book-open"\n  xmlns="http://www.w3.org/2000/svg"\n  width="20"\n  height="20"\n  viewBox="-1.5 -1.5 27 27"\n  fill="none"\n  stroke="currentColor"\n  stroke-width="1.8"\n  stroke-linecap="round"\n  stroke-linejoin="round"\n>\n  <path d="M12 7v14 M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />\n</svg>',
};
const MARKER = "data-minecodex-quick-prompts";
const zh = () => (document.documentElement.lang || navigator.language || "en").toLowerCase().startsWith("zh");
const text = (en, cn) => (zh() ? cn : en);
const style = document.createElement("style");
style.textContent = `
  [${MARKER}=page] .pm-title-control { display:flex; align-items:stretch; min-height:40px; border:1px solid var(--color-border-primary-outline); border-radius:var(--radius-lg); background:var(--color-background-primary-soft); overflow:hidden; }
  [${MARKER}=page] .pm-title-control:focus-within { border-color:var(--color-ring); }
  [${MARKER}=page] .pm-title-control>.pm-emoji-trigger { display:flex; flex:none; align-items:center; justify-content:center; width:40px; padding:0; border-inline-end:1px solid var(--color-border); }
  [${MARKER}=page] .pm-title-control>.pm-emoji-trigger:hover { background:var(--color-background-primary-ghost-hover); }
  [${MARKER}=page] .pm-title-control>.pm-emoji-trigger:focus-visible { outline-offset:-3px; }
  [${MARKER}=page] .pm-editor .pm-title-control>input { flex:1; min-width:0; border:0; border-radius:0; background:transparent; padding:8px 10px; outline:none; box-shadow:none; }

  [${MARKER}=panel] { position:fixed; z-index:50; zoom:var(--codex-window-zoom,1); transform:translateY(-100%); box-sizing:border-box; display:flex; flex-direction:column; overflow:hidden; padding:var(--spacing); border:1px solid var(--color-border); border-radius:var(--radius-suggestion-menu,var(--radius-2xl)); background:var(--color-surface-elevated-secondary); color:var(--color-text-primary); font-family:var(--font-sans-default); font-size:var(--text-sm); line-height:1.43; }
  [${MARKER}=panel] *, [${MARKER}=button] { box-sizing:border-box; }
  [${MARKER}=panel] button { cursor:var(--cursor-interaction,pointer); }
  [${MARKER}=panel] button:disabled { opacity:.4; cursor:default; }
  [${MARKER}=panel] button:focus-visible, [${MARKER}=panel] input:focus-visible, [${MARKER}=panel] textarea:focus-visible { outline:2px solid var(--color-ring,var(--color-text-secondary)); outline-offset:-2px; }
  [${MARKER}=panel] svg { width:16px; height:16px; flex:none; }
  [${MARKER}=panel] .qp-header { display:flex; align-items:center; justify-content:space-between; padding:var(--spacing) var(--padding-row-x,8px); color:var(--color-text-tertiary); flex:none; }
  [${MARKER}=panel] .qp-scroll { overflow-y:auto; min-height:0; padding-bottom:var(--spacing); }
  [${MARKER}=panel] .qp-row { display:flex; align-items:center; min-width:0; border-radius:var(--suggestion-menu-item-radius,var(--radius-xl)); }
  [${MARKER}=panel] .qp-row:hover, [${MARKER}=panel] .qp-row:focus-within { background:var(--color-background-primary-ghost-hover); }
  [${MARKER}=panel] .qp-select { display:flex; flex:1; align-items:center; min-width:0; gap:calc(var(--spacing)*1.5); text-align:left; padding:var(--suggestion-menu-item-padding,var(--app-menu-item-padding,var(--padding-row-y,5px) var(--padding-row-x,8px))); border-radius:inherit; }
  [${MARKER}=panel] .qp-title { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  [${MARKER}=panel] .qp-preview { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--color-text-tertiary); }
  [${MARKER}=panel] .qp-empty { padding:calc(var(--spacing)*3) var(--padding-row-x,8px); color:var(--color-text-tertiary); }
  [${MARKER}=panel] .qp-command { padding:var(--spacing) calc(var(--spacing)*2); border-radius:var(--radius-xl); }
  [${MARKER}=panel] .qp-command:hover { background:var(--color-background-primary-ghost-hover); }
  [${MARKER}=panel] .qp-error { color:var(--color-text-danger,var(--color-text-primary)); padding:var(--spacing) var(--padding-row-x,8px); }
  .qp-symbol { display:inline-flex; width:20px; height:20px; flex:none; align-items:center; justify-content:center; font-size:18px; line-height:1; color:var(--prompt-icon-light,var(--color-text-secondary)); }
  .qp-symbol svg { width:20px; height:20px; }
  .dark .qp-symbol, [data-theme=dark] .qp-symbol { color:var(--prompt-icon-dark,var(--color-text-secondary)); }
  [${MARKER}=page] { position:fixed; z-index:20; overflow:auto; border-radius:var(--radius-xl-base); background:var(--color-surface); color:var(--color-text-primary); font-family:var(--font-sans-default); font-size:var(--text-sm); line-height:var(--text-sm--line-height); }
  [${MARKER}=page] * { box-sizing:border-box; }
  [${MARKER}=page] button { cursor:var(--cursor-interaction,pointer); }
  [${MARKER}=page] button:disabled { opacity:.35; cursor:default; }
  [${MARKER}=page] button:focus-visible, [${MARKER}=page] input:focus-visible, [${MARKER}=page] textarea:focus-visible { outline:2px solid var(--color-text-secondary); outline-offset:2px; }
  [${MARKER}=page] .pm-wrap { max-width:1440px; margin:auto; padding:28px 48px 48px; }
  [${MARKER}=page] .pm-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:36px; margin-bottom:24px; }
  [${MARKER}=page] h1 { font-size:var(--text-heading-lg); font-weight:var(--font-weight-medium); line-height:1.2; margin:0; }
  [${MARKER}=page] h2 { font-size:var(--text-base,14px); font-weight:600; margin:24px 0 12px; }
  [${MARKER}=page] .pm-header-actions { display:flex; align-items:center; gap:8px; }
  [${MARKER}=page] .pm-tab-row { display:flex; align-items:center; gap:8px; margin-bottom:24px; }
  [${MARKER}=page] .pm-tab-row .pm-tabs { margin-bottom:0; min-width:0; }
  [${MARKER}=page] .pm-icon { display:flex; align-items:center; justify-content:center; width:32px; height:32px; flex:none; padding:0; border-radius:var(--radius-full); color:var(--color-text-secondary); }
  [${MARKER}=page] .pm-icon[hidden] { display:none; }
  [${MARKER}=page] .pm-icon svg { width:16px; height:16px; }
  [${MARKER}=page] .pm-icon:hover, [${MARKER}=page] .pm-icon[aria-expanded=true], [${MARKER}=page] .pm-icon[aria-pressed=true] { background:var(--color-background-primary-ghost-hover); color:var(--color-text-primary); }
  [${MARKER}=page] .pm-popup { position:fixed; z-index:30; width:200px; padding:var(--app-menu-gutter,var(--spacing)); border-radius:var(--radius-2xl); background:color-mix(in srgb,var(--color-surface-elevated-secondary) 90%,transparent); box-shadow:0 0 0 .5px var(--color-border),var(--shadow-xl-spread,0 8px 16px -4px rgba(0,0,0,.12)); backdrop-filter:blur(4px); }
  [${MARKER}=page] .pm-popup button { width:100%; min-height:var(--app-menu-item-height,30px); display:flex; align-items:center; justify-content:space-between; gap:16px; padding:var(--app-menu-item-padding,5px 8px); border-radius:var(--radius-xl); text-align:left; }
  [${MARKER}=page] .pm-popup button:hover, [${MARKER}=page] .pm-popup button:focus-visible { background:var(--color-background-primary-ghost-hover); }
  [${MARKER}=page] .pm-popup svg { width:16px; height:16px; }
  [${MARKER}=page] .pm-command { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:32px; padding:6px 12px; border-radius:var(--radius-full,999px); color:inherit; white-space:nowrap; }
  [${MARKER}=page] .pm-command:hover { background:var(--color-background-primary-ghost-hover); }
  [${MARKER}=page] .pm-primary { background:var(--color-background-primary-solid); color:var(--color-text-primary-solid); }
  [${MARKER}=page] .pm-primary:hover { background:var(--color-background-primary-solid-hover); }
  [${MARKER}=page] .pm-tabs { display:flex; gap:4px; overflow:auto; padding-bottom:4px; margin-bottom:24px; }
  [${MARKER}=page] .pm-tab { display:flex; align-items:center; gap:6px; flex:none; height:36px; border-radius:999px; padding:0 16px; font-weight:500; color:var(--color-text-secondary); }
  [${MARKER}=page] .pm-tab:hover, [${MARKER}=page] .pm-tab[aria-selected=true] { background:var(--color-background-primary-ghost-hover); color:var(--color-text-primary); }
  [${MARKER}=page] input, [${MARKER}=page] textarea { font:inherit; color:inherit; background:transparent; border:1px solid var(--color-border); border-radius:var(--radius-lg,12px); padding:8px 12px; }
  [${MARKER}=page] .pm-list { display:flex; flex-direction:column; gap:4px; }
  [${MARKER}=page] .pm-row { display:flex; align-items:center; gap:12px; padding:16px 12px; border-radius:var(--radius-xl,16px); }
  [${MARKER}=page] .pm-row:hover { background:var(--color-background-primary-ghost-hover); }
  [${MARKER}=page] .pm-info { flex:1; min-width:0; text-align:left; }
  [${MARKER}=page] .pm-title { font-weight:500; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  [${MARKER}=page] .pm-preview { color:var(--color-text-secondary); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; margin-top:3px; }
  [${MARKER}=page] .pm-stats { color:var(--color-text-tertiary); min-width:130px; text-align:right; font-variant-numeric:tabular-nums; font-size:var(--text-xs,12px); }
  [${MARKER}=page] .pm-count { color:var(--color-text-secondary); }
  [${MARKER}=page] .pm-empty { color:var(--color-text-tertiary); padding:48px 0; text-align:center; }
  [${MARKER}=page] .pm-form { display:flex; flex-direction:column; gap:16px; }
  [${MARKER}=page] .pm-field { display:flex; flex-direction:column; gap:6px; color:var(--color-text-secondary); }
  [${MARKER}=page] .pm-field textarea { min-height:220px; resize:vertical; color:var(--color-text-primary); }
  [${MARKER}=page] .pm-footer { display:flex; justify-content:flex-end; gap:8px; margin-top:8px; }
  [${MARKER}=page] .pm-grid { display:flex; flex-wrap:wrap; gap:4px; }
  [${MARKER}=page] .pm-choice { width:36px; height:36px; border-radius:10px; display:flex; justify-content:center; align-items:center; }
  [${MARKER}=page] .pm-choice[aria-pressed=true] { background:var(--color-background-primary-ghost-hover); outline:1px solid var(--color-text-secondary); }
  [${MARKER}=page] .pm-swatch { width:18px; height:18px; border-radius:50%; background:currentColor; }
  [${MARKER}=page] .pm-error { color:var(--color-text-danger,var(--color-text-primary)); margin:12px 0; }
  [${MARKER}=page] .pm-editor h2 { margin-top:0; }
  @media(max-width:800px) { [${MARKER}=page] .pm-wrap { padding:24px 30px; } [${MARKER}=page] .pm-stats { min-width:90px; } }
  [${MARKER}=page] .pm-modal-layer { position:fixed; inset:0; z-index:60; display:grid; place-items:center; padding:24px; background:var(--color-background-overlay,rgba(0,0,0,.16)); }
  [${MARKER}=page] .pm-editor { position:relative; top:auto; width:440px; max-width:calc(100vw - 48px); max-height:calc(100vh - 64px); margin:0; padding:20px; overflow:auto; border:0; border-radius:var(--radius-3xl,25px); background:color-mix(in srgb,var(--color-surface-elevated-secondary) 90%,transparent); box-shadow:0 0 0 .5px var(--color-border),var(--shadow-lg); backdrop-filter:blur(24px); }
  [${MARKER}=page] .pm-prompt-editor { width:520px; }
  [${MARKER}=page] .pm-modal-heading { display:flex; align-items:center; gap:8px; margin:0 0 16px; }
  [${MARKER}=page] .pm-modal-heading h2 { flex:1; font-size:var(--text-lg,18px); font-weight:600; line-height:28px; margin:0; }
  [${MARKER}=page] .pm-modal-heading .pm-icon { width:28px; height:28px; }
  [${MARKER}=page] .pm-editor .pm-row { min-height:44px; padding:8px; gap:10px; border-radius:var(--radius-lg); }
  [${MARKER}=page] .pm-editor .pm-form { gap:12px; }
  [${MARKER}=page] .pm-editor .pm-field { gap:8px; color:var(--color-text-primary); }
  [${MARKER}=page] .pm-editor input, [${MARKER}=page] .pm-editor textarea { border-radius:var(--radius-md); padding:8px 10px; background:var(--color-background-primary-soft,rgba(0,0,0,.025)); }
  [${MARKER}=page] .pm-editor .pm-footer { margin-top:20px; gap:12px; }
  [${MARKER}=page] .pm-editor .pm-footer .pm-command { border-radius:var(--radius-button-action,999px); min-height:32px; padding:6px 16px; background:var(--color-background-primary-ghost-hover); }
  [${MARKER}=page] .pm-editor .pm-footer .pm-primary { background:var(--color-background-primary-solid); color:var(--color-text-primary-solid); }
  [${MARKER}=page] .pm-editor .pm-footer .pm-primary:hover { background:var(--color-background-primary-solid-hover); }
  [${MARKER}=page] .pm-grid { gap:4px; }
  [${MARKER}=page] .pm-choice { width:36px; height:36px; border-radius:var(--radius-lg); }
  [${MARKER}=page] .pm-choice svg { width:20px; height:20px; }
  [${MARKER}=page] .pm-choice[aria-pressed=true] { outline:none; box-shadow:inset 0 0 0 1px var(--color-border); }
  [${MARKER}=page] .pm-search-inline { display:flex; align-items:center; width:clamp(150px,22vw,300px); height:32px; padding:0 12px; gap:8px; border:1px solid var(--color-border-primary-outline,var(--color-border)); border-radius:var(--radius-full); background:transparent; }
  [${MARKER}=page] .pm-search-inline input { min-width:0; width:100%; padding:0; border:0; background:transparent; outline:none; }
  [${MARKER}=page] .pm-search-inline>svg { width:16px; height:16px; flex:none; color:var(--color-text-tertiary); }
  [${MARKER}=page] .pm-list>h2 { color:var(--color-text-tertiary); font-size:var(--text-sm,13px); font-weight:500; }
  [${MARKER}=page] .pm-stats { min-width:64px; }
  [${MARKER}=page] .pm-modal-heading>.pm-icon:first-child { margin-left:-11px; }
  [${MARKER}=page] .pm-modal-heading>.pm-icon:last-child { margin-right:-10px; }
  [${MARKER}=page] .pm-editor input:focus, [${MARKER}=page] .pm-editor textarea:focus, [${MARKER}=page] .pm-popup input:focus { outline:none; box-shadow:none; border-color:var(--color-ring,var(--color-border-primary-outline)); }
  [${MARKER}=page] .pm-editor .pm-footer .pm-danger { color:var(--color-text-danger); background:var(--color-background-danger-soft-alpha); }
  [${MARKER}=page] .pm-editor .pm-footer .pm-danger:hover { background:var(--color-background-danger-soft-alpha-hover); }
  [${MARKER}=page] .pm-confirm-description { color:var(--color-text-secondary); line-height:1.6; }
  [${MARKER}=page] .pm-select { display:flex; align-items:center; gap:8px; min-height:36px; padding:8px 10px; background:var(--color-background-primary-soft); border:1px solid var(--color-border); border-radius:var(--radius-md); text-align:left; }
  [${MARKER}=page] .pm-select>svg { width:16px; height:16px; }
  [${MARKER}=page] .pm-option-label { flex:1; }
  [${MARKER}=page] .pm-empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:340px; gap:8px; text-align:center; }
  [${MARKER}=page] .pm-empty-art { font-size:var(--text-5xl,48px); line-height:1; margin-bottom:8px; }
  [${MARKER}=page] .pm-empty-title { font-size:var(--text-lg,18px); line-height:24px; font-weight:500; }
  [${MARKER}=page] .pm-empty-description { color:var(--color-text-secondary); }
  [${MARKER}=page] .pm-empty-state>.pm-command { margin-top:24px; }
  [${MARKER}=page] .pm-drag { cursor:grab; color:var(--color-text-tertiary); }
  [${MARKER}=page] .pm-drag:active { cursor:grabbing; }
  [${MARKER}=page] .pm-drop-placeholder { flex:none; border:1px dashed var(--color-border-primary-outline,var(--color-border)); border-radius:var(--radius-xl); background:var(--color-background-primary-ghost-hover); box-sizing:border-box; }
  [${MARKER}=page] .pm-dragging { position:absolute; opacity:0; pointer-events:none; }
  [${MARKER}=page] .pm-popup { z-index:70; max-height:calc(100vh - 32px); overflow:auto; }
  [${MARKER}=page] .pm-symbol-picker { width:320px; padding:12px; display:flex; flex-direction:column; gap:12px; }
  [${MARKER}=page] .pm-symbol-picker>input { width:100%; flex:none; border-radius:var(--radius-full); }
  [${MARKER}=page] .pm-emoji-grid { display:grid; grid-template-columns:repeat(8,minmax(0,1fr)); gap:4px; max-height:264px; overflow:auto; }
  [${MARKER}=page] .pm-emoji-grid .pm-emoji-choice { width:32px; height:32px; min-height:32px; padding:0; display:flex; justify-content:center; font-size:22px; border-radius:var(--radius-lg); }
  [${MARKER}=page] .pm-emoji-choice[aria-pressed=true] { background:var(--color-background-primary-ghost-hover); }
`;
document.head.append(style);
let button = null;
let addButton = null;
let composerCard = null;
let composerThread = null;
let panel = null;
let items = [];
let generation = 0;
let syncQueued = false;
let disposed = false;
let categories = [];
let nativeIcons = {};
let nativeEmojis = [];

const appearanceLabels = {"bar-chart": "柱状图", "book": "书籍", "brain": "大脑", "currency-dollar": "美元", "customize": "自定义", "dumbbell": "哑铃", "edit": "编辑", "flask": "烧瓶", "folder": "文件夹", "function": "函数", "globe": "地球", "graduation-cap": "学士帽", "heart": "爱心", "kettlebell": "壶铃", "logs": "笔记", "lotus": "莲花", "music": "音乐", "palette": "调色盘", "paw": "爪印", "plant": "植物", "popcorn": "爆米花", "scale": "天平", "stethoscope": "听诊器", "terminal": "终端", "wrench": "扳手", "writing": "写作", "blue": "蓝色", "green": "绿色", "orange": "橙色", "pink": "粉色", "purple": "紫色", "red": "红色", "yellow": "黄色", "black": "中性色"};
function appearanceLabel(key) {
  return text(key.replaceAll("-", " "), appearanceLabels[key] ?? key);
}
function errorMessage(error) {
  const messages = {
    "Category was not found": "未找到该分类",
    "Prompt was not found": "未找到该提示词",
    "Choose one emoji or leave it empty": "请选择一个 Emoji，或留空以继承分类图标",
    "Invalid sort order": "排序无效，请重试",
    "Invalid order": "排序无效，请重试",
    "Invalid category": "分类无效，请重试",
    "Items changed; refresh and try again": "条目已发生变化，请刷新后重试",
  };
  return text(error.message || "Something went wrong. Please try again.", messages[error.message] ?? "操作失败，请重试。");
}

// DOM 与图标工具
function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content != null) node.textContent = content;
  return node;
}
function icon(name) {
  return new DOMParser()
    .parseFromString(ICONS[name], "image/svg+xml")
    .documentElement.cloneNode(true);
}
function control(label, handler, className = "qp-command", iconName = null) {
  const node = element("button", className, iconName ? null : label);
  node.type = "button";
  node.setAttribute("aria-label", label);
  if (iconName) {
    node.append(icon(iconName));
    node.setAttribute("data-minecodex-tooltip", label);
  }
  node.addEventListener("click", handler);
  return node;
}
async function api(route, { method = "GET", body } = {}) {
  return config.requestHostAction("quick-prompts", { route, method, body });
}
function showError(error) {
  if (!panel) return;
  panel.querySelector(".qp-error")?.remove();
  const message = element("div", "qp-error", errorMessage(error));
  message.setAttribute("role", "alert");
  panel.append(message);
}
function position() {
  if (!panel || !composerCard?.isConnected) return;
  const rect = composerCard.getBoundingClientRect();
  const zoom = Number.parseFloat(getComputedStyle(panel).zoom) || 1;
  panel.style.left = `${rect.left / zoom}px`;
  panel.style.top = `${(rect.top - 4) / zoom}px`;
  panel.style.width = `${rect.width / zoom}px`;
  panel.style.maxHeight = `${Math.max(0, Math.min(400, (rect.top - 16) / zoom))}px`;
}
function close(restoreFocus = false) {
  generation++;
  panel?.remove();
  panel = null;

  button?.setAttribute("aria-expanded", "false");
  button?.setAttribute("data-state", "closed");
  if (restoreFocus) button?.focus({ preventScroll: true });
}
// 输入框 Popover：只浏览与插入
async function loadList() {
  const current = ++generation;

  panel.replaceChildren();

  panel.append(element("div", "qp-empty", text("Loading…", "加载中…")));
  try {
    const state = await api("/api/state");
    if (!panel || current !== generation) return;
    items = state.prompts;
    categories = state.categories;
    nativeIcons = state.icons;
    nativeEmojis = state.emojis ?? [];
    renderList();
  } catch (error) {
    if (panel && current === generation) {
      panel.querySelector(".qp-empty")?.remove();
      showError(error);
      panel.append(control(text("Retry", "重试"), loadList));
    }
  }
}
const COLORS = {
  black: ["var(--color-text-secondary)", "var(--color-text-secondary)"],
  blue: ["#0285ff", "#339cff"],
  green: ["#04b84c", "#40c977"],
  orange: ["#fb6a22", "#ff8549"],
  pink: ["#ff66ad", "#ff8cc1"],
  purple: ["#924ff7", "#ad7bf9"],
  red: ["#fa423e", "#ff6764"],
  yellow: ["#ffc300", "#ffd240"],
};
function categoryIcon(item) {
  const node = element("span", "qp-symbol");
  if (item.emoji) {
    node.textContent = item.emoji;
    return node;
  }
  const category = categories.find((entry) => entry.id === item.categoryId);
  const svg = new DOMParser().parseFromString(
    nativeIcons[category?.icon ?? "book"] ?? ICONS.prompt,
    "image/svg+xml",
  ).documentElement;
  node.append(svg.cloneNode(true));
  const colors = COLORS[category?.color ?? "black"] ?? COLORS.black;
  node.style.setProperty("--prompt-icon-light", colors[0]);
  node.style.setProperty("--prompt-icon-dark", colors[1]);
  return node;
}
function orderedItems(categoryId) {
  return items
    .filter((item) => item.categoryId === categoryId)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
}
function renderList() {
  panel.replaceChildren();
  const list = element("div", "qp-scroll");
  if (!items.length)
    list.append(
      element("div", "qp-empty", text("No prompts yet", "还没有提示词")),
    );
  const recent = items
    .filter((item) => item.useCount > 0)
    .sort((a, b) => b.calledAt - a.calledAt || a.id.localeCompare(b.id))
    .slice(0, 3);
  const sections = [
    { name: text("Recently used", "最近使用"), prompts: recent },
    ...categories.map((category) => ({
      name: category.name,
      prompts: orderedItems(category.id),
    })),
    { name: text("Other", "其他"), prompts: orderedItems(null) },
  ];
  for (const section of sections.filter((section) => section.prompts.length)) {
    list.append(element("div", "qp-header", section.name));
    for (const item of section.prompts) {
      const row = element("div", "qp-row");
      const insert = control(
        item.summary,
        async () => {
          const current = generation;
          try {
            window.__codexPersonalRuntime.insertText(item.body);
            // 插入同步成功后再记一次调用；失败和单纯浏览不计数。
            close();
            await api(`/api/prompts/${encodeURIComponent(item.id)}/use`, {
              method: "POST",
              body: { action: "insert", success: true },
            });
          } catch (error) {
            if (generation === current) showError(error);
            else console.warn("[Prompts] Usage could not be saved", error);
          }
        },
        "qp-select",
      );
      insert.replaceChildren(
        categoryIcon(item),
        element("span", "qp-title", item.summary),
      );
      if (item.title)
        insert.append(
          element("span", "qp-preview", item.body.replace(/\s+/g, " ")),
        );
      row.append(insert);
      list.append(row);
    }
  }
  panel.append(list);
  position();
}
function open() {
  if (panel) {
    close(true);
    return;
  }
  if (addButton.getAttribute("aria-expanded") === "true") addButton.click();
  panel = element("div");
  panel.setAttribute(MARKER, "panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", text("Quick Prompts", "快捷提示词"));
  document.body.append(panel);
  button.setAttribute("aria-expanded", "true");
  button.setAttribute("data-state", "open");
  position();
  void loadList();
}
function sync() {
  if (disposed || signal.aborted) return;
  syncNavigation();
  const add = [
    ...document.querySelectorAll("[data-codex-composer-root] button"),
  ].find(
    (node) =>
      node.getAttribute("data-composer-navigation-target") === "add-context",
  );
  const card = add?.closest("[data-codex-composer-root]");
  const thread =
    card
      ?.querySelector("[data-above-composer-conversation-id]")
      ?.getAttribute("data-above-composer-conversation-id") ?? null;
  if (thread !== composerThread) {
    close();
    composerThread = thread;
  }
  if (add !== addButton || card !== composerCard) {
    close();
    button?.remove();
    button = null;
    addButton = add;
    composerCard = card;
  }
  if (!add) return;
  if (
    panel &&
    [...card.querySelectorAll("button[aria-expanded=true]")].some(
      (node) => node !== button,
    )
  )
    close();
  if (!button) {
    button = add.cloneNode(false);
    button.removeAttribute("title");
    button.removeAttribute("aria-describedby");
    button.removeAttribute("id");
    button.removeAttribute("data-composer-navigation-target");
    button.setAttribute(MARKER, "button");
    button.setAttribute("aria-label", text("Quick Prompts", "快捷提示词"));
    button.setAttribute("data-minecodex-tooltip", text("Quick Prompts", "快捷提示词"));
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("data-state", "closed");
    // 保留 Add 的紧凑与常规图标容器，以同一规则响应窗口尺寸。
    for (const child of add.children) {
      const slot = child.cloneNode(true);
      for (const svg of slot.querySelectorAll("svg")) {
        const replacement = icon("prompt");
        for (const attr of [
          "class",
          "width",
          "height",
          "aria-hidden",
          "focusable",
        ]) {
          if (svg.hasAttribute(attr))
            replacement.setAttribute(attr, svg.getAttribute(attr));
        }
        svg.replaceWith(replacement);
      }
      button.append(slot);
    }
    button.addEventListener("click", open);
    add.after(button);
  }
  if (button.className !== add.className) button.className = add.className;
  position();
}
// 页面与快捷调用面板共享数据；所有编辑只存在于页面。
// 管理页面与编辑弹窗
let navButton = null;
let ownNavGroup = null;
let page = null;
let pageGeneration = 0;
let activeCategory = "all";
let pageSort = "manual";
let searchText = "";
let editor = null;
let pageFocus = null;
const hiddenSurfaces = new Map();
const nativeNavigationSelection = new Map();

function pageControl(label, handler, primary = false) {
  return control(label, handler, `pm-command${primary ? " pm-primary" : ""}`);
}
function pageError(error) {
  if (!page) return;
  page.querySelector(".pm-error")?.remove();
  const message = element("div", "pm-error", errorMessage(error));
  message.setAttribute("role", "alert");
  (editor ?? page.querySelector(".pm-wrap") ?? page).append(message);
}
function positionPage() {
  if (!page) return;
  const rail = document.querySelector("[data-app-navigation-rail]");
  if (!rail) {
    closePage();
    return;
  }
  const rect = rail.getBoundingClientRect();
  page.style.left = `${rect.right}px`;
  page.style.top = `${rect.top}px`;
  page.style.right = "4px";
  page.style.bottom = "4px";
}
function syncNavigationSelection() {
  if (!page) return;
  for (const node of document.querySelectorAll('[data-app-navigation-rail] [data-sidebar-destination][data-selected], [data-app-navigation-rail] [data-sidebar-destination][aria-current="page"]')) {
    if (!nativeNavigationSelection.has(node)) {
      nativeNavigationSelection.set(node, new Map(
        ["data-selected", "aria-current", "data-suppress-active-style"].map(name => [name, node.getAttribute(name)]),
      ));
    }
    node.removeAttribute("data-selected");
    node.removeAttribute("aria-current");
    node.setAttribute("data-suppress-active-style", "");
  }
  if (navButton && !navButton.hasAttribute("data-selected")) navButton.setAttribute("data-selected", "");
  if (navButton?.getAttribute("aria-current") !== "page") navButton?.setAttribute("aria-current", "page");
}
function restoreNavigationSelection() {
  // 退出覆盖页时还原原生状态，随后由原生路由接管新的选择。
  for (const [node, attributes] of nativeNavigationSelection) {
    if (!node.isConnected) continue;
    for (const [name, value] of attributes) {
      if (value === null) node.removeAttribute(name);
      else node.setAttribute(name, value);
    }
  }
  nativeNavigationSelection.clear();
}
function closePage(restoreFocus = false) {
  dragState?.cancel();
  pageGeneration++;
  closePagePopup();
  closeEditor(false);
  page?.remove();
  page = null;
  restoreNavigationSelection();
  editor = null;
  for (const [surface, inert] of hiddenSurfaces) surface.inert = inert;
  hiddenSurfaces.clear();
  navButton?.removeAttribute("data-selected");
  navButton?.removeAttribute("aria-current");
  document.documentElement.removeAttribute("data-mcx-prompts-open");
  if (restoreFocus && pageFocus?.isConnected)
    pageFocus.focus({ preventScroll: true });
}
async function loadPage() {
  const current = ++pageGeneration;
  try {
    const state = await api("/api/state");
    if (!page || current !== pageGeneration) return;
    items = state.prompts;
    categories = state.categories;
    nativeIcons = state.icons;
    nativeEmojis = state.emojis ?? [];
    renderPage();
  } catch (error) {
    if (current === pageGeneration) pageError(error);
  }
}
function openPage() {
  close();
  if (page) return;
  pageFocus = document.activeElement;
  page = element("section");
  page.setAttribute(MARKER, "page");
  page.setAttribute("aria-label", text("Prompts", "提示词"));
  document.body.append(page);
  // 只隔离主内容的焦点，保留导航栏与原生窗口控件。
  for (const surface of document.querySelectorAll(
    '[class*="_PageSurface_"], [class*="_Workspace_"]',
  )) {
    hiddenSurfaces.set(surface, surface.inert);
    surface.inert = true;
  }
  document.documentElement.setAttribute("data-mcx-prompts-open", "");
  navButton?.setAttribute("data-selected", "");
  navButton?.setAttribute("aria-current", "page");
  syncNavigationSelection();
  positionPage();
  page.append(element("div", "pm-empty", text("Loading…", "加载中…")));
  void loadPage();
}
let pagePopup = null;
let popupTrigger = null;
function pageIcon(label, name, handler) {
  const button = control(label, handler, "pm-icon", name);
  button.setAttribute("data-minecodex-tooltip", label);
  return button;
}
function closePagePopup(restoreFocus = false) {
  pagePopup?.remove();
  pagePopup = null;
  popupTrigger?.setAttribute("aria-expanded", "false");
  if (restoreFocus && popupTrigger?.isConnected)
    popupTrigger.focus({ preventScroll: true });
  popupTrigger = null;
}
function makePagePopup(trigger, className, role, matchTriggerWidth = false) {
  if (popupTrigger === trigger) {
    closePagePopup(true);
    return null;
  }
  closePagePopup();
  popupTrigger = trigger;
  trigger.setAttribute("aria-expanded", "true");
  pagePopup = element("div", `pm-popup ${className}`);
  pagePopup.setAttribute("role", role);
  pagePopup.setAttribute("aria-label", trigger.getAttribute("aria-label"));
  (editorLayer ?? page).append(pagePopup);
  const r = trigger.getBoundingClientRect();
  if (matchTriggerWidth) {
    pagePopup.style.boxSizing = "border-box";
    pagePopup.style.width = `${r.width}px`;
  }
  const width = pagePopup.getBoundingClientRect().width;
  pagePopup.style.top = `${r.bottom + 6}px`;
  pagePopup.style.left = `${Math.max(8, Math.min(r.right - width, innerWidth - width - 8))}px`;
  return pagePopup;
}
function makeSearchField() {
  const container = element("div", "pm-search-inline");
  const input = element("input");
  input.type = "text";
  input.autocomplete = "off";
  input.placeholder = text("Search prompts", "搜索提示词");
  input.setAttribute("aria-label", input.placeholder);
  input.value = searchText;
  const update = () => {
    searchText = input.value;
    renderRows(page.querySelector(".pm-list"));
  };
  input.addEventListener("input", update);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      input.value = "";
      update();
    }
  });
  container.append(icon("search"), input);
  return container;
}
function openSort(trigger) {
  const popup = makePagePopup(trigger, "", "menu");
  if (!popup) return;
  for (const [value, label] of [
    ["manual", text("Manual order", "手动排序")],
    ["usage", text("Most used", "调用次数")],
    ["recent", text("Recently used", "最近调用")],
  ]) {
    const choice = control(
      label,
      () => {
        pageSort = value;
        closePagePopup(true);
        renderRows(page.querySelector(".pm-list"));
      },
      "",
    );
    choice.setAttribute("role", "menuitemradio");
    choice.setAttribute("aria-checked", String(value === pageSort));
    if (value === pageSort) choice.append(icon("check"));
    popup.append(choice);
  }
  popup.querySelector("[aria-checked=true]")?.focus();
}
document.addEventListener(
  "pointerdown",
  (event) => {
    if (
      pagePopup &&
      !pagePopup.contains(event.target) &&
      !popupTrigger?.contains(event.target)
    )
      closePagePopup();
  },
  { signal },
);
document.addEventListener(
  "keydown",
  (event) => {
    if (!pagePopup) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePagePopup(true);
    } else if (
      pagePopup.getAttribute("role") === "menu" &&
      ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      event.preventDefault();
      const options = [...pagePopup.querySelectorAll("button")],
        index = options.indexOf(document.activeElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
              options.length;
      options[next]?.focus();
    }
  },
  { signal, capture: true },
);
document.addEventListener(
  "focusin",
  (event) => {
    if (
      pagePopup &&
      !pagePopup.contains(event.target) &&
      !popupTrigger?.contains(event.target)
    )
      closePagePopup();
  },
  { signal },
);
window.addEventListener("resize", () => closePagePopup(), { signal });

function renderPage() {
  if (!page) return;
  closeEditor(false);
  closePagePopup();
  editor = null;
  page.replaceChildren();
  const wrap = element("div", "pm-wrap");
  const heading = element("div", "pm-heading");
  const actions = element("div", "pm-header-actions");
  const searchField = makeSearchField();
  const sortButton = pageIcon(
    text("Sort prompts", "提示词排序"),
    "arrow-down-wide-narrow",
    () => openSort(sortButton),
  );
  sortButton.setAttribute("aria-haspopup", "menu");
  actions.append(
    sortButton,
    pageIcon(text("Edit categories", "编辑分类"), "settings", manageCategories),
    searchField,
    pageControl(text("New prompt", "新建提示词"), () => editPrompt(), true),
  );
  heading.append(element("h1", "", text("Prompts", "提示词")), actions);
  const tabs = element("div", "pm-tabs");
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", text("Categories", "分类"));
  const choices = [
    { id: "all", name: "All" },
    ...categories,
    { id: "uncategorized", name: text("Other", "其他") },
  ];
  if (!choices.some((c) => c.id === activeCategory)) activeCategory = "all";
  choices.forEach((category) => {
    const tab = control(
      category.name,
      () => {
        activeCategory = category.id;
        renderPage();
      },
      "pm-tab",
    );
    if (category.id !== "all")
      tab.prepend(categoryIcon({ categoryId: category.id === "uncategorized" ? null : category.id }));
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(activeCategory === category.id));
    tab.tabIndex = activeCategory === category.id ? 0 : -1;
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      event.preventDefault();
      const index = choices.indexOf(category);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? choices.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + choices.length) %
              choices.length;
      activeCategory = choices[next].id;
      renderPage();
      page.querySelector("[aria-selected=true]")?.focus();
    });
    tabs.append(tab);
  });
  const tabRow = element("div", "pm-tab-row");
  tabRow.append(tabs);
  const list = element("div", "pm-list");
  wrap.append(heading, tabRow, list);
  page.append(wrap);
  renderRows(list);
}
function renderRows(list) {
  list.replaceChildren();
  const query = searchText.trim().toLocaleLowerCase();
  const groups = [...categories, { id: null, name: text("Other", "其他") }];
  let shown = items.filter(
    (item) =>
      (activeCategory === "all" ||
        item.categoryId ===
          (activeCategory === "uncategorized" ? null : activeCategory)) &&
      (!query ||
        `${item.title}\n${item.body}`.toLocaleLowerCase().includes(query)),
  );
  if (!shown.length) {
    list.append(emptyState(Boolean(query)));
    return;
  }
  if (pageSort === "usage")
    shown.sort(
      (a, b) =>
        b.useCount - a.useCount || (b.calledAt ?? 0) - (a.calledAt ?? 0),
    );
  if (pageSort === "recent")
    shown.sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0));
  const sections =
    pageSort === "manual"
      ? groups
          .map((c) => ({
            name: c.name,
            items: orderedItems(c.id).filter((p) => shown.includes(p)),
          }))
          .filter((c) => c.items.length)
      : [{ items: shown }];
  for (const section of sections) {
    if (section.name && activeCategory === "all")
      list.append(element("h2", "", section.name));
    for (const item of section.items) {
      const row = element("div", "pm-row");
      row.dataset.promptId = item.id;
      const info = control(item.summary, () => editPrompt(item), "pm-info");
      info.replaceChildren(
        element("div", "pm-title", item.summary),
        element("div", "pm-preview", item.body.replace(/\s+/g, " ")),
      );
      const stats = element("div", "pm-stats");
      stats.append(
        element(
          "div",
          "pm-count",
          pageSort === "recent"
            ? item.calledAt == null
              ? text("Never used", "尚未调用")
              : new Intl.DateTimeFormat(zh() ? "zh-CN" : "en", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                }).format(new Date(item.calledAt))
            : text(`${item.useCount} ${item.useCount === 1 ? "call" : "calls"}`, `${item.useCount} 次调用`),
        ),
      );
      row.append(categoryIcon(item), info, stats);
      if (pageSort === "manual" && !query)
        row.append(
          orderControls(item, orderedItems(item.categoryId), false, row),
        );
      list.append(row);
    }
  }
}
function emptyState(searching) {
  const empty = element("div", "pm-empty-state");
  const art = element("span", "pm-empty-art", searching ? "🔎" : "📖");
  art.setAttribute("role", "img");
  art.setAttribute("aria-label", text("Prompts", "提示词"));
  empty.append(
    art,
    element(
      "div",
      "pm-empty-title",
      searching
        ? text("No prompts found", "未找到提示词")
        : text("No prompts yet", "暂无提示词"),
    ),
    element(
      "div",
      "pm-empty-description",
      searching
        ? text("Try a different search.", "试试其他关键词。")
        : text(
            "Save a prompt to use it again in any chat.",
            "收藏提示词，在任意对话中快速调用。",
          ),
    ),
  );
  if (!searching)
    empty.append(
      pageControl(text("New prompt", "新建提示词"), () => editPrompt(), true),
    );
  return empty;
}
let dragState = null;
function orderControls(item, ordered, isCategory, row) {
  const handle = pageIcon(
    text("Drag to reorder", "拖拽排序"),
    "drag",
    () => {},
  );
  handle.classList.add("pm-drag");
  handle.setAttribute("data-minecodex-tooltip", text(
    "Drag to reorder · Alt + ↑ / ↓",
    "拖拽排序 · Alt + ↑ / ↓",
  ));
  row.dataset.orderId = item.id;
  const group = isCategory ? "categories" : `prompts:${item.categoryId ?? ""}`;
  row.dataset.orderGroup = group;
  async function save(ids) {
    try {
      await api("/api/reorder", {
        method: "POST",
        body: {
          ids,
          categoryId: item.categoryId ?? null,
          categories: isCategory,
        },
      });
      await loadPage();
      if (isCategory && page) manageCategories();
    } catch (error) {
      pageError(error);
    }
  }
  // 原生拖影跟随指针，占位块负责布局；仅同组条目参与让位。
  handle.addEventListener("pointerdown", () => { row.draggable = true; });
  handle.addEventListener("pointerup", () => { row.draggable = false; });
  row.addEventListener("dragstart", (event) => {
    if (dragState) return;
    const parent = row.parentElement;
    const siblings = [...parent.children].filter(node => node.dataset.orderGroup === group);
    const originalNext = row.nextSibling;
    const placeholder = element("div", "pm-drop-placeholder");
    placeholder.style.height = `${row.getBoundingClientRect().height}px`;
    placeholder.setAttribute("aria-hidden", "true");
    const lifetime = new AbortController();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animations = new Map();
    let started = false;
    let finished = false;
    const duration = reduced ? 0 : 180;
    function movePlaceholder(before) {
      if (placeholder.nextSibling === before || before === placeholder) return;
      const positions = new Map(siblings.filter(node => node !== row).map(node => [node, node.getBoundingClientRect().top]));
      for (const animation of animations.values()) animation.cancel();
      animations.clear();
      parent.insertBefore(placeholder, before);
      for (const [node, top] of positions) {
        const delta = top - node.getBoundingClientRect().top;
        if (delta && duration) animations.set(node, node.animate([
          { transform: `translateY(${delta}px)` }, { transform: "translateY(0)" },
        ], { duration, easing: "cubic-bezier(.2,.8,.2,1)" }));
      }
    }
    function finish(commit) {
      if (finished) return;
      finished = true;
      lifetime.abort();
      dragState = null;
      row.draggable = false;
      if (!started) return;
      if (!commit) movePlaceholder(originalNext);
      parent.insertBefore(row, placeholder);
      row.classList.remove("pm-dragging");
      placeholder.remove();
      const ids = [...parent.children].filter(node => node.dataset.orderGroup === group).map(node => node.dataset.orderId);
      const landing = row.animate([{ opacity: .45 }, { opacity: 1 }], { duration: reduced ? 0 : 140, easing: "ease-out" });
      if (commit && ids.some((id, index) => id !== ordered[index].id)) {
        void landing.finished.catch(() => {}).then(() => save(ids));
      }
    }
    dragState = { cancel: () => finish(false) };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
    // 等浏览器截取拖影后再隐藏原行，避免拖影变成空白。
    requestAnimationFrame(() => {
      if (finished || !row.isConnected) return;
      row.before(placeholder);
      row.classList.add("pm-dragging");
      started = true;
    });
    parent.addEventListener("dragover", event => {
      if (!started) return;
      const target = event.target.closest("[data-order-group], .pm-drop-placeholder");
      if (target !== placeholder && (!siblings.includes(target) || target === row)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (target === placeholder) return;
      // 使用布局位置判断插入点，不受让位动画的 transform 影响。
      const rect = target.getBoundingClientRect();
      const transform = getComputedStyle(target).transform;
      const translateY = transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
      const after = event.clientY > rect.top - translateY + rect.height / 2;
      movePlaceholder(after ? target.nextSibling : target);
    }, { signal: lifetime.signal });
    parent.addEventListener("drop", event => {
      const target = event.target.closest("[data-order-group], .pm-drop-placeholder");
      if (target !== placeholder && !siblings.includes(target)) return;
      event.preventDefault();
      finish(true);
    }, { signal: lifetime.signal });
    row.addEventListener("dragend", () => finish(false), { once: true, signal: lifetime.signal });
    signal.addEventListener("abort", () => finish(false), { once: true, signal: lifetime.signal });
  });
  handle.addEventListener("keydown", (event) => {
    if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const ids = ordered.map((x) => x.id),
      from = ids.indexOf(item.id),
      to = from + (event.key === "ArrowUp" ? -1 : 1);
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void save(ids);
  });
  return handle;
}
function field(label, input) {
  const node = element("label", "pm-field", label);
  node.append(input);
  return node;
}
let editorLayer = null;
let editorReturnFocus = null;
function closeEditor(restoreFocus = true) {
  dragState?.cancel();
  closePagePopup();
  editorLayer?.remove();
  editorLayer = null;
  editor = null;
  const wrap = page?.querySelector(".pm-wrap");
  if (wrap) wrap.inert = false;
  if (restoreFocus && editorReturnFocus?.isConnected)
    editorReturnFocus.focus({ preventScroll: true });
}
function editorShell(title, back = null) {
  closePagePopup();
  if (!editorLayer) {
    editorReturnFocus = document.activeElement;
    editorLayer = element("div", "pm-modal-layer");
    page.append(editorLayer);
    page.querySelector(".pm-wrap").inert = true;
  }
  editorLayer.replaceChildren();
  editor = element("div", "pm-editor");
  editor.setAttribute("role", "dialog");
  editor.setAttribute("aria-modal", "true");
  editor.setAttribute("aria-label", title);
  editor.tabIndex = -1;
  const heading = element("div", "pm-modal-heading");
  if (back) heading.append(pageIcon(text("Back", "返回"), "back", back));
  heading.append(
    element("h2", "", title),
    pageIcon(text("Close", "关闭"), "x", () => closeEditor()),
  );
  editor.append(heading);
  editorLayer.append(editor);
  editor.focus();
  return editor;
}
document.addEventListener(
  "keydown",
  (event) => {
    if (!editorLayer || !editor || pagePopup) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeEditor();
    }
    if (event.key === "Tab") {
      const controls = [
        ...editor.querySelectorAll(
          'button:not(:disabled),input,select,textarea,[tabindex="0"]',
        ),
      ].filter((x) => x.getBoundingClientRect().width);
      const first = controls[0],
        last = controls.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === editor)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  },
  { signal, capture: true },
);
function editPrompt(item = null) {
  const target = editorShell(
    item ? text("Edit prompt", "编辑提示词") : text("New prompt", "新建提示词"),
  );
  target.classList.add("pm-prompt-editor");
  const form = element("form", "pm-form");
  const title = element("input");
  title.value = item?.title ?? "";
  title.maxLength = 200;
  const category = {
    value:
      item?.categoryId ??
      (categories.some((c) => c.id === activeCategory) ? activeCategory : ""),
  };
  const emoji = { value: item?.emoji ?? "" };
  const categoryButton = control(
    "",
    () => {
      const popup = makePagePopup(categoryButton, "pm-category-menu", "menu", true);
      if (!popup) return;
      for (const c of [
        ...categories,
        { id: "", name: text("Other", "其他") },
      ]) {
        const choice = control(
          c.name,
          () => {
            category.value = c.id;
            refreshAppearance();
            closePagePopup(true);
          },
          "",
        );
        choice.replaceChildren(
          categoryIcon({ categoryId: c.id || null }),
          element("span", "pm-option-label", c.name),
        );
        choice.setAttribute("role", "menuitemradio");
        choice.setAttribute("aria-checked", String(category.value === c.id));
        if (category.value === c.id) choice.append(icon("check"));
        popup.append(choice);
      }
      popup.querySelector("[aria-checked=true]")?.focus();
    },
    "pm-select",
  );
  categoryButton.setAttribute("aria-haspopup", "menu");
  const emojiButton = control(
    text("Choose icon", "选择图标"),
    () => openEmojiPicker(emojiButton, emoji, refreshAppearance),
    "pm-emoji-trigger",
  );
  emojiButton.setAttribute("aria-haspopup", "dialog");
  function refreshAppearance() {
    const c = categories.find((c) => c.id === category.value);
    categoryButton.replaceChildren(
      categoryIcon({ categoryId: category.value || null }),
      element("span", "pm-option-label", c?.name ?? text("Other", "其他")),
      icon("chevron"),
    );
    categoryButton.setAttribute(
      "aria-label",
      text("Category: ", "分类：") + (c?.name ?? text("Other", "其他")),
    );
    emojiButton.replaceChildren(
      categoryIcon({ categoryId: category.value || null, emoji: emoji.value }),
    );
    emojiButton.setAttribute("data-minecodex-tooltip", text("Choose icon", "选择图标"));
  }
  refreshAppearance();
  const body = element("textarea");
  body.value = item?.body ?? "";
  body.required = true;
  const titleControl = element("div", "pm-title-control");
  titleControl.setAttribute("role", "group");
  titleControl.setAttribute("aria-label", text("Prompt title and icon", "提示词标题与图标"));
  title.setAttribute("aria-label", text("Title", "标题"));
  title.placeholder = text("Title", "标题");
  titleControl.append(emojiButton, title);
  form.append(
    titleControl,
    field(text("Category", "分类"), categoryButton),
    field(text("Prompt", "提示词"), body),
  );
  const footer = element("div", "pm-footer");
  if (item) {
    const remove = pageControl(text("Delete", "删除"), async () => {
      if (remove.dataset.confirm !== "true") {
        remove.dataset.confirm = "true";
        remove.textContent = text("Confirm delete", "确认删除");
        return;
      }
      remove.disabled = true;
      try {
        await api(`/api/prompts/${item.id}`, { method: "DELETE" });
        if (editor === target) await loadPage();
      } catch (error) {
        remove.disabled = false;
        pageError(error);
      }
    });
    remove.classList.add("pm-danger");
    remove.style.marginRight = "auto";
    footer.append(remove);
  }
  const save = pageControl(text("Save", "保存"), () => {}, true);
  save.type = "submit";
  footer.append(pageControl(text("Cancel", "取消"), renderPage), save);
  form.append(footer);
  target.append(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (save.disabled || !body.value.trim()) return;
    save.disabled = true;
    try {
      await api(item ? `/api/prompts/${item.id}` : "/api/prompts", {
        method: item ? "PATCH" : "POST",
        body: {
          title: title.value,
          body: body.value,
          categoryId: category.value || null,
          emoji: emoji.value.trim(),
        },
      });
      if (editor === target) await loadPage();
    } catch (error) {
      if (editor === target) {
        save.disabled = false;
        pageError(error);
      }
    }
  });
  title.focus();
}
function openEmojiPicker(trigger, selected, refresh) {
  const popup = makePagePopup(trigger, "pm-symbol-picker", "dialog");
  if (!popup) return;
  const search = element("input");
  search.placeholder = text("Search emoji", "搜索 Emoji");
  search.setAttribute("aria-label", search.placeholder);
  const grid = element("div", "pm-emoji-grid");
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", text("Emojis", "Emoji"));
  const render = () => {
    grid.replaceChildren();
    const query = search.value.trim().toLocaleLowerCase();
    for (const item of nativeEmojis.filter(
      (e) => !query || e[0].includes(query) || e[1].includes(query),
    )) {
      const choice = control(
        item[1],
        () => {
          selected.value = item[0];
          refresh();
          closePagePopup(true);
        },
        "pm-emoji-choice",
      );
      choice.textContent = item[0];
      choice.setAttribute("aria-pressed", String(selected.value === item[0]));
      grid.append(choice);
    }
    if (!grid.children.length)
      grid.append(
        element(
          "div",
          "pm-empty-description",
          text("No emoji found", "未找到 Emoji"),
        ),
      );
  };
  search.addEventListener("input", render);
  const reset = control(
    text("Use category icon", "使用分类图标"),
    () => {
      selected.value = "";
      refresh();
      closePagePopup(true);
    },
    "pm-command",
  );
  popup.append(search, grid, reset);
  render();
  search.focus();
  const r = popup.getBoundingClientRect();
  popup.style.left = `${Math.max(8, Math.min(trigger.getBoundingClientRect().left, innerWidth - r.width - 8))}px`;
  if (r.bottom > innerHeight - 16)
    popup.style.top = `${Math.max(16, innerHeight - r.height - 16)}px`;
  popup.addEventListener("keydown", (event) => {
    const choices = [...grid.querySelectorAll("button")],
      index = choices.indexOf(document.activeElement);
    if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      event.preventDefault();
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[
        event.key
      ];
      choices[Math.max(0, Math.min(choices.length - 1, index + step))]?.focus();
    }
    if (event.key === "Tab") {
      const buttons = [search, ...choices, reset],
        i = buttons.indexOf(document.activeElement);
      if (event.shiftKey && i === 0) {
        event.preventDefault();
        reset.focus();
      } else if (!event.shiftKey && i === buttons.length - 1) {
        event.preventDefault();
        search.focus();
      }
    }
  });
}
function manageCategories() {
  const target = editorShell(text("Categories", "分类"));
  const footer = element("div", "pm-footer");
  footer.append(
    pageControl(text("New category", "新建分类"), () => editCategory(), true),
  );
  for (const category of categories) {
    const row = element("div", "pm-row");
    row.append(
      categoryIcon({ categoryId: category.id }),
      control(category.name, () => editCategory(category), "pm-info"),
      orderControls(category, categories, true, row),
    );
    target.append(row);
  }
  target.append(footer);
}
function editCategory(category = null) {
  const target = editorShell(
    category
      ? text("Edit category", "编辑分类")
      : text("New category", "新建分类"),
    manageCategories,
  );
  const form = element("form", "pm-form");
  const name = element("input");
  name.value = category?.name ?? "";
  name.required = true;
  name.maxLength = 60;
  let selectedIcon = category?.icon ?? "book",
    selectedColor = category?.color ?? "black";
  const icons = element("div", "pm-grid");
  icons.setAttribute("aria-label", text("Category icon", "分类图标"));
  function refreshChoices() {
    icons.replaceChildren();
    for (const key of Object.keys(nativeIcons)) {
      const btn = control(
        key,
        () => {
          selectedIcon = key;
          refreshChoices();
        },
        "pm-choice",
      );
      const svg = new DOMParser().parseFromString(
        nativeIcons[key],
        "image/svg+xml",
      ).documentElement;
      btn.replaceChildren(svg);
      btn.setAttribute("aria-pressed", String(key === selectedIcon));
      btn.setAttribute("data-minecodex-tooltip", appearanceLabel(key));
      btn.setAttribute("aria-label", appearanceLabel(key));
      icons.append(btn);
    }
  }
  refreshChoices();
  const colors = element("div", "pm-grid");
  for (const key of Object.keys(COLORS)) {
    const btn = control(
      key,
      () => {
        selectedColor = key;
        for (const child of colors.children)
          child.setAttribute("aria-pressed", String(child === btn));
      },
      "pm-choice",
    );
    const swatch = element("span", "qp-symbol");
    swatch.style.setProperty("--prompt-icon-light", COLORS[key][0]);
    swatch.style.setProperty("--prompt-icon-dark", COLORS[key][1]);
    swatch.append(element("span", "pm-swatch"));
    btn.replaceChildren(swatch);
    btn.setAttribute("aria-pressed", String(key === selectedColor));
    btn.setAttribute("data-minecodex-tooltip", appearanceLabel(key));
      btn.setAttribute("aria-label", appearanceLabel(key));
    colors.append(btn);
  }
  form.append(
    field(text("Name", "名称"), name),
    element("div", "", text("Icon", "图标")),
    icons,
    element("div", "", text("Color", "颜色")),
    colors,
  );
  const footer = element("div", "pm-footer");
  if (category) {
    const remove = pageControl(text("Delete", "删除"), () => {
      const count = items.filter(
        (item) => item.categoryId === category.id,
      ).length;
      const destroy = async (button) => {
        button.disabled = true;
        try {
          await api(`/api/categories/${category.id}`, { method: "DELETE" });
          await loadPage();
          if (page) manageCategories();
        } catch (error) {
          button.disabled = false;
          pageError(error);
        }
      };
      if (!count) {
        void destroy(remove);
        return;
      }
      const confirmation = editorShell(text("Delete category?", "删除分类？"));
      confirmation.append(
        element(
          "p",
          "pm-confirm-description",
          text(
            `${count} prompts will move to Other. Their content and call counts will be kept.`,
            `${count} 条提示词将移到 Other，内容和调用次数都会保留。`,
          ),
        ),
      );
      const actions = element("div", "pm-footer");
      const confirm = pageControl(
        text("Delete", "删除"),
        () => void destroy(confirm),
      );
      confirm.classList.add("pm-danger");
      actions.append(
        pageControl(text("Cancel", "取消"), () => editCategory(category)),
        confirm,
      );
      confirmation.append(actions);
    });
    remove.classList.add("pm-danger");
    remove.style.marginRight = "auto";
    footer.append(remove);
  }
  const save = pageControl(text("Save", "保存"), () => {}, true);
  save.type = "submit";
  footer.append(pageControl(text("Cancel", "取消"), manageCategories), save);
  form.append(footer);
  target.append(form);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (save.disabled) return;
    save.disabled = true;
    try {
      await api(
        category ? `/api/categories/${category.id}` : "/api/categories",
        {
          method: category ? "PATCH" : "POST",
          body: { name: name.value, icon: selectedIcon, color: selectedColor },
        },
      );
      if (editor === target) {
        await loadPage();
        if (page) manageCategories();
      }
    } catch (error) {
      if (editor === target) {
        save.disabled = false;
        pageError(error);
      }
    }
  });
  name.focus();
}
// 原生导航挂载与卸载
function syncNavigation() {
  const rail = document.querySelector("[data-app-navigation-rail]");
  if (!rail) {
    navButton?.remove();
    navButton = null;
    if (page) closePage();
    return;
  }
  const source =
    rail.querySelector('[data-sidebar-destination="builtin:projects"]') ??
    rail.querySelector('[data-sidebar-destination="builtin:library"]');
  if (!source) return;
  // 固定扩展区是独立容器；不依赖 Projects 的固定状态或文字。
  const scroll = rail.querySelector(".overflow-y-auto");
  if (!scroll) return;
  let group = [...scroll.children].find(
    (node) =>
      node !== ownNavGroup &&
      node.classList.contains("flex-col") &&
      node.classList.contains("shrink-0"),
  );
  if (!group) {
    if (!ownNavGroup) {
      ownNavGroup = element("div", "flex shrink-0 flex-col items-center gap-2");
      ownNavGroup.setAttribute(MARKER, "nav-group");
    }
    if (ownNavGroup.parentElement !== scroll) scroll.append(ownNavGroup);
    group = ownNavGroup;
  }
  if (!navButton?.isConnected) {
    navButton = source.cloneNode(false);
    navButton.removeAttribute("id");
    navButton.removeAttribute("title");
    navButton.removeAttribute("aria-describedby");
    navButton.removeAttribute("data-sidebar-destination");
    navButton.removeAttribute("data-selected");
    navButton.removeAttribute("aria-current");
    navButton.removeAttribute("data-suppress-active-style");
    navButton.setAttribute(MARKER, "nav");
    navButton.setAttribute("aria-label", text("Prompts", "提示词"));
    navButton.setAttribute("data-minecodex-tooltip", text("Prompts", "提示词"));
    const inner = element("span", source.firstElementChild?.className ?? "");
    const glyph = icon("prompt-nav");
    glyph.setAttribute("aria-hidden", "true");
    inner.append(glyph, element("span", "sr-only", text("Prompts", "提示词")));
    navButton.append(inner);
    navButton.addEventListener("click", openPage);
  }
  if (navButton.parentElement !== group || navButton !== group.lastElementChild)
    group.append(navButton);
  if (group !== ownNavGroup) ownNavGroup?.remove();
  syncNavigationSelection();
  positionPage();
}
document.addEventListener(
  "click",
  (event) => {
    if (
      page &&
      event.target.closest("[data-app-navigation-rail] button") &&
      !navButton?.contains(event.target)
    )
      closePage();
  },
  { signal, capture: true },
);
window.addEventListener("popstate", () => closePage(), { signal });
window.addEventListener("resize", positionPage, { signal });

const observer = new MutationObserver(() => {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    sync();
  });
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: [
    "data-composer-placement",
    "data-above-composer-conversation-id",
    "aria-expanded",
    "data-selected",
    "aria-current",
  ],
});
document.addEventListener(
  "pointerdown",
  (event) => {
    if (
      panel &&
      !panel.contains(event.target) &&
      !button?.contains(event.target)
    )
      close();
  },
  { signal },
);
document.addEventListener(
  "keydown",
  (event) => {
    if (!panel) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close(true);
    } else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const choices = [...panel.querySelectorAll(".qp-select")];
      const current = choices.indexOf(document.activeElement);
      const next =
        event.key === "ArrowDown"
          ? (current + 1) % choices.length
          : (current <= 0 ? choices.length : current) - 1;
      choices[next]?.focus();
    }
  },
  { signal, capture: true },
);
window.addEventListener("resize", position, { signal });
window.addEventListener("scroll", position, { signal, capture: true });
sync();
return () => {
  disposed = true;
  observer.disconnect();
  close();
  button?.remove();
  closePage();
  navButton?.remove();
  ownNavGroup?.remove();
  style.remove();
};
