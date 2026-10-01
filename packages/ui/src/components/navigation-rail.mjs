// 导航只覆盖展示状态；原生路由与 sidebar hover 行为仍由 Codex 管理。
export function installNavigationRail(signal, ui, native) {
  const snapshots = new Map();
  const style = document.createElement("style");
  style.setAttribute("data-minecodex-ui-styles", "navigation-rail");
  style.textContent = `[data-mcx-native-rail-icon-hidden]{display:none!important}`;
  document.head.append(style);
  function restore() {
    for (const [node, state] of snapshots) {
      state.icon?.removeAttribute("data-mcx-native-rail-icon-hidden");
      state.replacement?.remove();
      if (!node.isConnected) continue;
      for (const [name, value] of state.attributes) {
        if (value === null) node.removeAttribute(name);
        else node.setAttribute(name, value);
      }
    }
    snapshots.clear();
  }
  function selection(button, selected) {
    if (selected) {
      if (!button.hasAttribute("data-selected")) button.setAttribute("data-selected", "");
      if (button.getAttribute("aria-current") !== "page") button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("data-selected");
      button.removeAttribute("aria-current");
    }
    for (const glyph of button.querySelectorAll("[data-mcx-rail-glyph]")) {
      glyph.style.display = glyph.getAttribute("data-mcx-rail-glyph") === (selected ? "selected" : "default") ? "" : "none";
    }
  }
  function reconcile(button, selected) {
    selection(button, selected);
    if (!selected) restore();
    const rail = button.closest("[data-app-navigation-rail]");
    for (const node of rail?.querySelectorAll("[data-sidebar-destination]") ?? []) {
      const icon = node.querySelector("svg:not([data-mcx-native-rail-icon])");
      if (!icon) continue;
      const item = native.item(node);
      const active = item ? item.isCurrentDestination : node.getAttribute("aria-current") === "page";
      if (!active && !snapshots.has(node)) native.remember(node, icon);
      if (!selected || (!active && !node.hasAttribute("data-selected"))) continue;
      let state = snapshots.get(node);
      if (!state) {
        state = { attributes:new Map(["data-selected", "aria-current", "data-suppress-active-style"]
          .map(name => [name, node.getAttribute(name)])) };
        snapshots.set(node, state);
      }
      if (active && state.icon !== icon) {
        state.icon?.removeAttribute("data-mcx-native-rail-icon-hidden");
        state.replacement?.remove();
        state.icon = icon;
        state.replacement = native.icon(node, icon);
        if (state.replacement) {
          state.replacement.setAttribute("data-mcx-native-rail-icon", "");
          icon.after(state.replacement);
          icon.setAttribute("data-mcx-native-rail-icon-hidden", "");
        }
      }
      node.removeAttribute("data-selected");
      node.removeAttribute("aria-current");
      if (!node.hasAttribute("data-suppress-active-style")) node.setAttribute("data-suppress-active-style", "");
    }
  }
  function navigationRail(button, { defaultIcon, selectedIcon }) {
    defaultIcon.setAttribute("data-mcx-rail-glyph", "default");
    selectedIcon.setAttribute("data-mcx-rail-glyph", "selected");
    defaultIcon.setAttribute("aria-hidden", "true");
    selectedIcon.setAttribute("aria-hidden", "true");
    defaultIcon.after(selectedIcon);
    button.setAttribute("data-minecodex-tooltip-side", "right");
    selection(button, false);
    return { select:selected => reconcile(button, selected), restore };
  }
  signal.addEventListener("abort", () => { restore(); style.remove(); }, { once:true });
  return { navigationRail };
}
