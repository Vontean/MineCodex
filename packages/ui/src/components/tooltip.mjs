// 自包含函数随运行时注入；只处理 MineCodex 标记，不接管原生 tooltip。
export function installFeatureTooltips(signal) {
  const attribute = "data-minecodex-tooltip";
  const tip = document.createElement("div");
  tip.id = "minecodex-feature-tooltip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  const style = document.createElement("style");
  style.setAttribute("data-minecodex-ui-styles", "tooltip");
  style.textContent = `
    [data-mcx-ui-tooltip] { position:fixed;z-index:2147483001;pointer-events:none;box-sizing:border-box;
      padding:calc(var(--mcx-spacing) * 1.25) calc(var(--mcx-spacing) * 3);border:1px solid var(--mcx-color-border-tooltip);border-radius:var(--mcx-radius-2xl);corner-shape:var(--mcx-codex-corner-shape);
      background:var(--mcx-color-background-tooltip);color:var(--mcx-color-text-tooltip);box-shadow:var(--mcx-shadow-tooltip);
      font-family:var(--mcx-font-sans-default);font-size:var(--mcx-text-sm);line-height:18px;
      font-weight:var(--mcx-tooltip-compact-font-weight);letter-spacing:var(--mcx-tracking-tooltip);user-select:none; }
  `;
  document.head.append(style);
  function tooltipSurface(node) { node.setAttribute("data-mcx-ui-tooltip", ""); return node; }
  tooltipSurface(tip);
  tip.style.cssText = `zoom:var(--codex-window-zoom,1);max-width:min(320px,calc(100vw - 16px));
    text-align:center;overflow-wrap:anywhere;`;
  let anchor = null;
  let timer;
  let frame;
  let lastClosedAt = -Infinity;
  function hide() {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    if (anchor) {
      const ids = (anchor.getAttribute("aria-describedby") || "").split(/\s+/).filter(id => id && id !== tip.id);
      if (ids.length) anchor.setAttribute("aria-describedby", ids.join(" "));
      else anchor.removeAttribute("aria-describedby");
    }
    if (!tip.hidden) lastClosedAt = Date.now();
    anchor = null;
    tip.hidden = true;
  }
  function position() {
    if (!anchor?.isConnected || !anchor.getClientRects().length || anchor.getAttribute("aria-expanded") === "true") return hide();
    const zoom = Number.parseFloat(getComputedStyle(tip).zoom) || 1;
    const r = anchor.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    // navbar 固定向右；普通控件跟随宿主的上下侧偏好，统一 2px 间距。
    const side = anchor.getAttribute("data-minecodex-tooltip-side")
      || (anchor.closest("[data-app-navigation-rail]") ? "right"
        : getComputedStyle(anchor).getPropertyValue("--side-tooltip").trim() || "top");
    const gap = 2 / zoom;
    let x = (r.left + r.width / 2) / zoom - w / 2;
    let y = side === "bottom" ? r.bottom / zoom + gap : r.top / zoom - h - gap;
    if (side === "right" || side === "left") {
      x = side === "right" ? r.right / zoom + gap : r.left / zoom - w - gap;
      y = (r.top + r.height / 2) / zoom - h / 2;
      if (x + w > innerWidth / zoom - 8) x = r.left / zoom - w - gap;
      else if (x < 8) x = r.right / zoom + gap;
    } else if (y < 8) y = r.bottom / zoom + gap;
    else if (y + h > innerHeight / zoom - 8) y = r.top / zoom - h - gap;
    tip.style.left = `${Math.max(8, Math.min(x, innerWidth / zoom - w - 8))}px`;
    tip.style.top = `${Math.max(8, Math.min(y, innerHeight / zoom - h - 8))}px`;
    frame = requestAnimationFrame(position);
  }
  function show(target, immediate = false) {
    if (!target || target === anchor) return;
    hide();
    if (target.getAttribute("aria-expanded") === "true" || !target.getAttribute(attribute)) return;
    anchor = target;
    timer = setTimeout(() => {
      if (!anchor?.isConnected) return hide();
      if (!tip.isConnected) document.body.append(tip);
      const theme = getComputedStyle(anchor);
      for (const name of ["--radius-2xl", "--codex-corner-shape", "--color-background-tooltip", "--color-text-tooltip",
        "--color-border-tooltip", "--shadow-tooltip", "--tooltip-compact-font-weight", "--tracking-tooltip",
        "--spacing", "--text-sm", "--font-sans-default"]) {
        const value = theme.getPropertyValue(name).trim();
        if (value) tip.style.setProperty(name, value);
        else tip.style.removeProperty(name);
      }
      tip.textContent = anchor.getAttribute(attribute);
      tip.hidden = false;
      const ids = (anchor.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
      anchor.setAttribute("aria-describedby", [...new Set([...ids, tip.id])].join(" "));
      position();
    }, immediate || Date.now() - lastClosedAt < 300 ? 0 : 200);
  }
  const targetOf = event => event.target instanceof Element ? event.target.closest(`[${attribute}]`) : null;
  document.addEventListener("pointerover", event => show(targetOf(event)), { signal });
  document.addEventListener("pointerout", event => {
    if (anchor && !anchor.contains(event.relatedTarget)) hide();
  }, { signal });
  document.addEventListener("focusin", event => show(targetOf(event), true), { signal });
  document.addEventListener("focusout", hide, { signal });
  document.addEventListener("pointerdown", hide, { signal, capture: true });
  document.addEventListener("keydown", event => { if (event.key === "Escape") hide(); }, { signal });
  window.addEventListener("blur", hide, { signal });
  signal.addEventListener("abort", () => { hide(); tip.remove(); style.remove(); }, { once: true });
  return { tooltipSurface };
}
