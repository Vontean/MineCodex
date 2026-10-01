// 读取原生导航资源；不修改 React props，也不调用带 Hooks 的图标组件。
export function createNativeRailAdapter(codex) {
  const defaultIcons = new WeakMap();
  function nativeItem(node) {
    for (let fiber = codex.currentFiber(node); fiber; fiber = fiber.return) {
      const item = fiber.memoizedProps?.item;
      if (item?.id === node.getAttribute("data-sidebar-destination")) return item;
    }
    return null;
  }
  function defaultIcon(node, current) {
    const item = nativeItem(node);
    const resource = item?.railIcons?.default;
    const factory = resource?.createElement ?? resource?.type?.createElement;
    // 原生图标工厂显式暴露无 Hooks 的 DOM API，包含 optical 与主题处理。
    if (factory) return factory(document, current.getAttribute("class") || "");
    if (resource && resource === item.railIcons.selected) return current.cloneNode(true);
    const asset = resource?.props?.asset;
    // 新版原生 IconAsset 的单色资源可直接读取，不调用带 Hooks 的 React 组件。
    if (asset?.paint?.kind === "monochrome" && typeof asset.body === "string") {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      for (const [name, value] of Object.entries({ width:asset.canvas.width, height:asset.canvas.height,
        viewBox:asset.canvas.viewBox, "aria-hidden":"true", class:current.getAttribute("class") || "" })) {
        svg.setAttribute(name, String(value));
      }
      svg.innerHTML = asset.body;
      return svg;
    }
    return defaultIcons.get(node)?.cloneNode(true) ?? null;
  }
  return { item:nativeItem, icon:defaultIcon,
    remember:(node, icon) => defaultIcons.set(node, icon.cloneNode(true)) };
}
