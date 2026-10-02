// 挂载角色统一维护；模态 top layer 仍由原生 dialog 负责。
export function installLayers(signal) {
  const style = document.createElement("style");
  style.setAttribute("data-minecodex-ui-styles", "layers");
  style.textContent = `
    [data-mcx-ui-layer=page] { position:fixed; z-index:20; }
    [data-mcx-ui-layer=notification] { position:fixed; z-index:30; }
    [data-mcx-ui-layer=floating], [data-mcx-ui-layer=modal] { position:fixed; z-index:50; }
  `;
  document.head.append(style);
  signal.addEventListener("abort", () => style.remove(), { once:true });
  function layer(node, role) { node.setAttribute("data-mcx-ui-layer", role); return node; }
  function mount(node, role, parent = document.body) { layer(node, role); parent.append(node); return node; }
  return { layer, mount };
}
