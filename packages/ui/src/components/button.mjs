// 随组件库组装为自包含 Renderer 安装函数。
export function installButton(signal, ui) {
  const style = document.createElement("style");
  style.setAttribute("data-minecodex-ui-styles", "installButton");
  style.textContent = `    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer] { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:12px; margin-top:12px; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>button { display:inline-flex; align-items:center; justify-content:center; gap:var(--mcx-button-gap-lg); height:var(--mcx-control-size-lg); flex-shrink:0; padding:0 calc(var(--mcx-control-gutter-md) * var(--mcx-control-gutter-pill-scaling)); border:0; border-radius:var(--mcx-radius-full); font:inherit; font-size:var(--mcx-control-font-size-md); font-weight:400; line-height:1; white-space:nowrap; color:var(--mcx-color-text-primary); background:transparent; box-shadow:inset 0 0 0 1px var(--mcx-color-border-primary-outline); cursor:var(--cursor-interaction); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>button:hover:not(:disabled):not([aria-disabled=true]) { background:var(--mcx-color-background-primary-outline-hover); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=ghost] { color:var(--mcx-color-text-secondary); box-shadow:none; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=ghost]:hover:not(:disabled):not([aria-disabled=true]) { background:var(--mcx-color-background-primary-ghost-hover); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=primary] { box-shadow:none; background:var(--mcx-color-background-primary-solid); color:var(--mcx-color-text-primary-solid); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=primary]:hover:not(:disabled):not([aria-disabled=true]) { background:var(--mcx-color-background-primary-solid-hover); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=danger] { box-shadow:none; background:var(--mcx-color-background-danger-soft-alpha); color:var(--mcx-color-text-danger); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=danger]:hover:not(:disabled):not([aria-disabled=true]) { background:var(--mcx-color-background-danger-soft-alpha-hover); }
    [data-mcx-ui-action=danger-solid], [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=danger-solid] { box-shadow:none; border-color:transparent; background:var(--mcx-color-background-danger-solid); color:var(--mcx-color-text-danger-solid); }
    [data-mcx-ui-action=danger-solid]:hover:not(:disabled):not([aria-disabled=true]), [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>[data-mcx-ui-action=danger-solid]:hover:not(:disabled):not([aria-disabled=true]) { background:color-mix(in oklab,var(--mcx-color-background-danger-solid) 90%,transparent); }
    [data-mcx-ui-surface=dialog] button:disabled { opacity:.4; cursor:default; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-close]:focus-visible, [data-mcx-ui-surface=dialog] [data-mcx-ui-footer]>button:focus-visible { outline:2px solid var(--mcx-color-ring); outline-offset:0; }
  `;
  document.head.append(style);
  signal.addEventListener("abort", () => style.remove(), { once:true });
  const mark = (node, role, value = "") => { node.setAttribute(`data-mcx-ui-${role}`, value); return node; };
  return { footer:node=>mark(node,"footer"), action:(node,tone="secondary")=>mark(node,"action",tone) };
}
