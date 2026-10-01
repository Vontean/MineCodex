// 自包含共享外壳；插件保留内容、定位、焦点与关闭生命周期。
export function installFeatureDialogs(signal) {
  const style = document.createElement("style");
  style.setAttribute("data-minecodex-dialog-styles", "");
  style.textContent = `
    [data-mcx-ui-surface] { background:color-mix(in oklab,var(--color-surface-elevated-secondary) 90%,transparent); box-shadow:0 0 0 .5px var(--color-border),var(--shadow-lg); backdrop-filter:blur(var(--blur-xl)); -webkit-backdrop-filter:blur(var(--blur-xl)); }
    [data-mcx-ui-surface=popover] { box-shadow:0 0 0 .5px var(--color-border),var(--shadow-xl-spread); backdrop-filter:blur(var(--blur-xs)); -webkit-backdrop-filter:blur(var(--blur-xs)); }
    html[data-owl-native-glass=active] [data-mcx-ui-surface=popover] { -owl-native-material:glass; --owl-native-glass-adaptive-appearance:off; --owl-native-glass-variant:regular; corner-shape:round; box-shadow:none; backdrop-filter:none; -webkit-backdrop-filter:none; }
    html[data-owl-native-glass=active] [data-mcx-ui-surface=popover][data-owl-native-source-underlay] { background:color-mix(in srgb,var(--color-surface) 16%,transparent); }
    [data-mcx-ui-surface=dialog]:not(dialog) { position:relative; }
    [data-mcx-ui-surface=dialog] { box-sizing:border-box; padding:var(--modal-container-inner-padding); border:0; border-radius:var(--radius-3xl); background:var(--color-surface-elevated-secondary); box-shadow:0 0 0 .5px var(--color-border),var(--shadow-lg); backdrop-filter:none; -webkit-backdrop-filter:none; color:var(--color-text-primary); font-family:var(--font-sans-default); font-size:var(--text-base); line-height:1.5; outline:none; }
    [data-mcx-ui-overlay], [data-mcx-ui-surface=dialog]::backdrop { background:var(--lightningcss-light,#e3e3e380) var(--lightningcss-dark,#00000080); backdrop-filter:var(--dialog-backdrop-fade-filter); -webkit-backdrop-filter:var(--dialog-backdrop-fade-filter); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-heading] { display:flex; align-items:center; gap:8px; padding-right:28px; margin:0 0 12px; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-heading] h2 { flex:1; min-width:0; margin:0; font-size:var(--text-heading-md); line-height:1.4; font-weight:var(--font-weight-semibold); letter-spacing:normal; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-close] { position:absolute; top:16px; right:16px; display:flex; align-items:center; justify-content:center; width:24px; height:24px; padding:4px; border:0; border-radius:4px; background:transparent; color:color-mix(in srgb,var(--color-text-primary) 80%,transparent); cursor:var(--cursor-interaction); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-close] svg { display:block; width:16px; height:16px; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-close]:hover { background:var(--color-background-primary-ghost-hover); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer] { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:12px; margin-top:12px; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>button { display:inline-flex; align-items:center; justify-content:center; gap:var(--button-gap-lg); height:var(--control-size-lg); flex-shrink:0; padding:0 calc(var(--control-gutter-md) * var(--control-gutter-pill-scaling)); border:0; border-radius:var(--radius-full); font:inherit; font-size:var(--control-font-size-md); font-weight:400; line-height:1; white-space:nowrap; color:var(--color-text-primary); background:transparent; box-shadow:inset 0 0 0 1px var(--color-border-primary-outline); cursor:var(--cursor-interaction); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>button:hover:not(:disabled):not([aria-disabled=true]) { background:var(--color-background-primary-outline-hover); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=ghost] { color:var(--color-text-secondary); box-shadow:none; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=ghost]:hover:not(:disabled):not([aria-disabled=true]) { background:var(--color-background-primary-ghost-hover); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=primary] { box-shadow:none; background:var(--color-background-primary-solid); color:var(--color-text-primary-solid); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=primary]:hover:not(:disabled):not([aria-disabled=true]) { background:var(--color-background-primary-solid-hover); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=danger] { box-shadow:none; background:var(--color-background-danger-soft-alpha); color:var(--color-text-danger); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=danger]:hover:not(:disabled):not([aria-disabled=true]) { background:var(--color-background-danger-soft-alpha-hover); }
    [data-mcx-ui-surface=dialog] button:disabled { opacity:.4; cursor:default; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-close]:focus-visible, [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>button:focus-visible { outline:2px solid var(--color-ring); outline-offset:0; }
  `;
  document.head.append(style);
  signal.addEventListener("abort", () => style.remove(), { once:true });
  const mark = (node, role, value = "") => { node.setAttribute(`data-mcx-ui-${role}`, value); return node; };
  function surface(node, kind = "popover") { return mark(node, "surface", kind); }
  function heading(container, { title, closeLabel, onClose, back }) {
    surface(container, "dialog");
    const header = mark(document.createElement("div"), "heading");
    const h = document.createElement("h2"); h.textContent = title;
    if (back) header.append(back);
    header.append(h);
    const close = mark(document.createElement("button"), "close");
    close.type = "button"; close.setAttribute("aria-label", closeLabel);
    // 取自新版 Sites 原生 Close，保留其真实路径。
    close.innerHTML = '<svg viewBox="0 0 21 21" fill="none" aria-hidden="true"><path d="M14.6549 5.57307C14.9283 5.2997 15.3718 5.2997 15.6451 5.57307C15.9185 5.84643 15.9185 6.28993 15.6451 6.5633L11.3903 10.8182L15.6451 15.0731L15.735 15.1834C15.9141 15.4551 15.8842 15.8242 15.6451 16.0633C15.4061 16.3024 15.0369 16.3322 14.7653 16.1531L14.6549 16.0633L10.4 11.8084L6.14515 16.0633C5.87178 16.3367 5.42828 16.3367 5.15492 16.0633C4.88155 15.7899 4.88155 15.3464 5.15492 15.0731L9.4098 10.8182L5.15492 6.5633L5.06507 6.45295C4.88597 6.18128 4.91584 5.81214 5.15492 5.57307C5.39399 5.33399 5.76313 5.30413 6.0348 5.48322L6.14515 5.57307L10.4 9.82795L14.6549 5.57307Z" fill="currentColor"/></svg>';
    close.addEventListener("click", onClose);
    container.append(header, close);
    return header;
  }
  return { surface, heading, overlay:node=>mark(node,"overlay"), footer:node=>mark(node,"footer"), action:(node,tone="secondary")=>mark(node,"action",tone) };
}
