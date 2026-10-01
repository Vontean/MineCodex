// 材质按原生组件分支选择，定位和业务内容由调用方提供。
export function installSurfaces(signal, ui) {
  const style = document.createElement("style");
  style.setAttribute("data-minecodex-ui-styles", "surfaces");
  style.textContent = `
    [data-mcx-ui-surface] { background:var(--color-surface-elevated-secondary); backdrop-filter:none; -webkit-backdrop-filter:none; }
    [data-mcx-ui-surface=dialog] { box-shadow:0 0 0 .5px var(--color-border),var(--shadow-lg); }
    [data-mcx-ui-surface=dialog][data-mcx-ui-variant=default] { background:color-mix(in oklab,var(--color-surface-elevated-secondary) 90%,transparent); backdrop-filter:blur(var(--blur-xl)); -webkit-backdrop-filter:blur(var(--blur-xl)); }
    [data-mcx-ui-overlay], [data-mcx-ui-surface=dialog]::backdrop { background:var(--lightningcss-light,#e3e3e380) var(--lightningcss-dark,#00000080); backdrop-filter:var(--dialog-backdrop-fade-filter); -webkit-backdrop-filter:var(--dialog-backdrop-fade-filter); }
    [data-mcx-ui-overlay=default], [data-mcx-ui-surface=dialog][data-mcx-ui-variant=default]::backdrop { background:var(--color-dialog-overlay); backdrop-filter:none; -webkit-backdrop-filter:none; }
    [data-mcx-ui-surface=dropdown] { background:color-mix(in oklab,var(--color-surface-elevated-secondary) 90%,transparent); box-shadow:0 0 0 var(--dropdown-overlay-ring-width,.5px) var(--color-border-overlay),var(--shadow-dropdown-overlay,var(--shadow-xl-spread)); backdrop-filter:blur(var(--blur-sm)); -webkit-backdrop-filter:blur(var(--blur-sm)); }
    [data-mcx-ui-surface=dropdown][data-mcx-ui-variant=opaque] { background:var(--color-surface-elevated-secondary); backdrop-filter:none; -webkit-backdrop-filter:none; }
    [data-mcx-ui-surface=popover] { box-shadow:0 0 0 var(--popover-overlay-ring-width,.5px) var(--color-border-overlay),var(--shadow-popover-overlay,var(--shadow-lg)); }
    [data-mcx-ui-surface=popover][data-mcx-ui-variant=translucent] { background:color-mix(in oklab,var(--color-surface-elevated-secondary) 90%,transparent); }
    [data-mcx-ui-surface=composer-menu] { border:var(--suggestion-menu-border-width,1px) solid var(--color-border); border-radius:var(--radius-suggestion-menu,var(--radius-2xl)); box-shadow:var(--suggestion-menu-shadow,none); }
    [data-mcx-ui-surface=page] { border-radius:var(--radius-xl-base); background:var(--color-surface); box-shadow:none; }
    [data-mcx-ui-surface=page][data-mcx-ui-variant=transparent] { background:transparent; }
  `;
  document.head.append(style);
  signal.addEventListener("abort", () => style.remove(), { once:true });
  function surface(node, kind = "popover", { variant, opaque = true } = {}) {
    const defaults = { dialog:"opaque", dropdown:"menu", popover:opaque ? "opaque" : "translucent", "composer-menu":"floating", page:"opaque" };
    if (!(kind in defaults)) throw new Error(`Unknown UI surface: ${kind}`);
    if (kind !== "dialog" && kind !== "page") ui.layer(node, "floating");
    node.setAttribute("data-mcx-ui-surface", kind);
    node.setAttribute("data-mcx-ui-variant", variant ?? defaults[kind]);
    return node;
  }
  function overlay(node, variant = "opaque") {
    node.setAttribute("data-mcx-ui-overlay", variant);
    return node;
  }
  return { surface, overlay };
}
