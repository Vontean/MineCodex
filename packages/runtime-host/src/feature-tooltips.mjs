// 自包含函数随运行时注入；只处理 MineCodex 标记，不接管原生 tooltip。
export function installFeatureTooltips(signal) {
  const attribute = "data-minecodex-tooltip";
  const tip = document.createElement("div");
  tip.id = "minecodex-feature-tooltip";
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  tip.style.cssText = `position:fixed;z-index:2147483001;pointer-events:none;box-sizing:border-box;
    zoom:var(--codex-window-zoom,1);max-width:min(320px,calc(100vw - 16px));
    padding:5px 12px;border:1px solid var(--color-border-tooltip);border-radius:var(--radius-2xl);
    background:var(--color-background-tooltip);color:var(--color-text-tooltip);box-shadow:var(--shadow-tooltip);
    font-family:var(--font-sans-default);font-size:var(--text-sm);line-height:18px;
    font-weight:var(--tooltip-compact-font-weight);letter-spacing:var(--tracking-tooltip);
    text-align:center;overflow-wrap:anywhere;user-select:none;`;
  let anchor = null;
  let timer;
  let frame;
  function hide() {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    if (anchor) {
      const ids = (anchor.getAttribute("aria-describedby") || "").split(/\s+/).filter(id => id && id !== tip.id);
      if (ids.length) anchor.setAttribute("aria-describedby", ids.join(" "));
      else anchor.removeAttribute("aria-describedby");
    }
    anchor = null;
    tip.hidden = true;
  }
  function position() {
    if (!anchor?.isConnected || !anchor.getClientRects().length || anchor.getAttribute("aria-expanded") === "true") return hide();
    const zoom = Number.parseFloat(getComputedStyle(tip).zoom) || 1;
    const r = anchor.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const top = r.top / zoom - h - 8;
    tip.style.left = `${Math.max(8, Math.min((r.left + r.width / 2) / zoom - w / 2, innerWidth / zoom - w - 8))}px`;
    tip.style.top = `${top >= 8 ? top : r.bottom / zoom + 8}px`;
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
      tip.textContent = anchor.getAttribute(attribute);
      tip.hidden = false;
      const ids = (anchor.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean);
      anchor.setAttribute("aria-describedby", [...new Set([...ids, tip.id])].join(" "));
      position();
    }, immediate ? 0 : 450);
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
  signal.addEventListener("abort", () => { hide(); tip.remove(); }, { once: true });
}
