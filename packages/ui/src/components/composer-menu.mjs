// 与原生 Add 一样锚定输入框主体；diff 与请求队列不参与位置计算。
export function installComposerMenu(signal, ui) {
  return {
    composerMenu(node, anchor, { gap = 4, maxHeight = 400 } = {}) {
      const body = anchor.closest("[data-composer-body]");
      if (!body) throw new Error("Composer body is unavailable");
      ui.surface(node, "composer-menu");
      ui.layer(node, "floating");
      const rect = body.getBoundingClientRect();
      const root = anchor.closest("[data-codex-composer-root], [data-chatgpt-composer]");
      const nativeSide = anchor.closest("[data-dropdown-overlay-side]")?.getAttribute("data-dropdown-overlay-side");
      // 新会话跟随原生 Add 方向，不能仅凭 home 将 Codex 模式改为向下。
      const below = root?.getAttribute("data-composer-placement") === "home" && nativeSide === "bottom";
      const zoom = Number.parseFloat(getComputedStyle(node).zoom) || 1;
      node.style.left = `${rect.left / zoom}px`;
      node.style.top = `${(below ? rect.bottom + gap : rect.top - gap) / zoom}px`;
      node.style.transform = below ? "translateY(0)" : "translateY(-100%)";
      node.style.width = `${rect.width / zoom}px`;
      const availableHeight = below ? innerHeight - rect.bottom - gap - 16 : rect.top - 16;
      node.style.maxHeight = `${Math.max(0, Math.min(maxHeight, availableHeight / zoom))}px`;
      return node;
    },
  };
}
