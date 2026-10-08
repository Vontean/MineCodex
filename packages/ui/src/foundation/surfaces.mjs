// 材质按原生组件分支选择，定位和业务内容由调用方提供。
export function installSurfaces(signal, ui) {
  const style = document.createElement("style");
  style.setAttribute("data-minecodex-ui-styles", "surfaces");
  style.textContent = `
    [data-mcx-ui-surface] { background:var(--mcx-color-surface-elevated-secondary); backdrop-filter:none; -webkit-backdrop-filter:none; }
    [data-mcx-ui-surface=dialog] { box-shadow:0 0 0 .5px var(--mcx-color-border),var(--mcx-shadow-lg); }
    [data-mcx-ui-surface=dialog][data-mcx-ui-variant=default] { background:color-mix(in oklab,var(--mcx-color-surface-elevated-secondary) 90%,transparent); backdrop-filter:blur(var(--mcx-blur-xl)); -webkit-backdrop-filter:blur(var(--mcx-blur-xl)); }
    [data-mcx-ui-overlay], [data-mcx-ui-surface=dialog]::backdrop { background:var(--lightningcss-light,#e3e3e380) var(--lightningcss-dark,#00000080); backdrop-filter:var(--mcx-dialog-backdrop-fade-filter); -webkit-backdrop-filter:var(--mcx-dialog-backdrop-fade-filter); }
    [data-mcx-ui-overlay=default], [data-mcx-ui-surface=dialog][data-mcx-ui-variant=default]::backdrop { background:var(--mcx-color-dialog-overlay); backdrop-filter:none; -webkit-backdrop-filter:none; }
    [data-mcx-ui-surface=dropdown] { background:color-mix(in oklab,var(--mcx-color-surface-elevated-secondary) 90%,transparent); box-shadow:0 0 0 var(--mcx-dropdown-overlay-ring-width,.5px) var(--mcx-color-border-overlay),var(--mcx-shadow-dropdown-overlay,var(--mcx-shadow-xl-spread)); backdrop-filter:blur(var(--mcx-blur-sm)); -webkit-backdrop-filter:blur(var(--mcx-blur-sm)); }
    [data-mcx-ui-surface=dropdown][data-mcx-ui-variant=opaque] { background:var(--mcx-color-surface-elevated-secondary); backdrop-filter:none; -webkit-backdrop-filter:none; }
    [data-mcx-ui-surface=popover] { box-shadow:0 0 0 var(--mcx-popover-overlay-ring-width,.5px) var(--mcx-color-border-overlay),var(--mcx-shadow-popover-overlay,var(--mcx-shadow-lg)); }
    [data-mcx-ui-surface=popover][data-mcx-ui-variant=translucent] { background:color-mix(in oklab,var(--mcx-color-surface-elevated-secondary) 90%,transparent); }
    [data-mcx-ui-surface=composer-menu] { border:var(--mcx-suggestion-menu-border-width,1px) solid var(--mcx-color-border); border-radius:var(--mcx-radius-suggestion-menu,var(--mcx-radius-2xl)); box-shadow:var(--mcx-suggestion-menu-shadow,none); }
    [data-mcx-ui-surface=floating-panel] { box-shadow:0 0 0 .5px var(--mcx-color-border),var(--mcx-shadow-2xl); }
    [data-mcx-ui-surface=page] { border-radius:var(--mcx-radius-xl-base); background:var(--mcx-color-surface); box-shadow:none; }
    [data-mcx-ui-surface=page][data-mcx-ui-variant=transparent] { background:transparent; }
  `;
  document.head.append(style);
  signal.addEventListener("abort", () => style.remove(), { once:true });
  function surface(node, kind = "popover", { variant, opaque = true } = {}) {
    const defaults = { dialog:"opaque", dropdown:"menu", popover:opaque ? "opaque" : "translucent", "composer-menu":"floating", page:"opaque", "floating-panel":"opaque" };
    if (!(kind in defaults)) throw new Error(`Unknown UI surface: ${kind}`);
    if (kind !== "dialog" && kind !== "page" && kind !== "floating-panel") ui.layer(node, "floating");
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
