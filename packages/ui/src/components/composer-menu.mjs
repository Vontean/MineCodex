// 与原生 Add 一样锚定输入框主体；diff 与请求队列不参与位置计算。
export function installComposerMenu(signal, ui) {
  return {
    composerMenu(node, anchor, { gap = 4, maxHeight = 400 } = {}) {
      const body = anchor.closest("[data-composer-body]");
      if (!body) throw new Error("Composer body is unavailable");
      ui.surface(node, "composer-menu");
      ui.layer(node, "floating");
      const rect = body.getBoundingClientRect();
      const zoom = Number.parseFloat(getComputedStyle(node).zoom) || 1;
      node.style.left = `${rect.left / zoom}px`;
      node.style.top = `${(rect.top - gap) / zoom}px`;
      node.style.width = `${rect.width / zoom}px`;
      node.style.maxHeight = `${Math.max(0, Math.min(maxHeight, (rect.top - 16) / zoom))}px`;
      return node;
    },
  };
}
