// 随组件库组装为自包含 Renderer 安装函数。
export function installDialog(signal, ui) {
  const style = document.createElement("style");
  style.setAttribute("data-minecodex-ui-styles", "installDialog");
  style.textContent = `    [data-mcx-ui-surface=dialog]:not(dialog) { position:relative; }
    [data-mcx-ui-surface=dialog] { box-sizing:border-box; padding:var(--modal-container-inner-padding); border:0; border-radius:var(--radius-3xl); corner-shape:round; color:var(--color-text-primary); font-family:var(--font-sans-default); font-size:var(--text-base); line-height:1.5; outline:none; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-heading] { display:flex; align-items:center; gap:8px; padding-right:28px; margin:0 0 12px; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-heading] h2 { flex:1; min-width:0; margin:0; font-size:var(--text-heading-md); line-height:1.4; font-weight:var(--font-weight-semibold); letter-spacing:normal; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-close] { position:absolute; top:16px; right:16px; display:flex; align-items:center; justify-content:center; width:24px; height:24px; padding:4px; border:0; border-radius:4px; background:transparent; color:color-mix(in srgb,var(--color-text-primary) 80%,transparent); cursor:var(--cursor-interaction); }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-close] svg { display:block; width:16px; height:16px; }
    [data-mcx-ui-surface=dialog] [data-mcx-ui-close]:hover { background:var(--color-background-primary-ghost-hover); }
  `;
  document.head.append(style);
  signal.addEventListener("abort", () => style.remove(), { once:true });
  function heading(container, { title, closeLabel, onClose, back, variant = "opaque" }) {
    ui.surface(container, "dialog", { variant });
    const header = document.createElement("div");
    header.setAttribute("data-mcx-ui-heading", "");
    const h = document.createElement("h2"); h.textContent = title;
    if (back) header.append(back);
    header.append(h);
    const close = document.createElement("button");
    close.setAttribute("data-mcx-ui-close", "");
    close.type = "button"; close.setAttribute("aria-label", closeLabel);
    // 取自新版 Sites 原生 Close，保留其真实路径。
    close.innerHTML = '<svg viewBox="0 0 21 21" fill="none" aria-hidden="true"><path d="M14.6549 5.57307C14.9283 5.2997 15.3718 5.2997 15.6451 5.57307C15.9185 5.84643 15.9185 6.28993 15.6451 6.5633L11.3903 10.8182L15.6451 15.0731L15.735 15.1834C15.9141 15.4551 15.8842 15.8242 15.6451 16.0633C15.4061 16.3024 15.0369 16.3322 14.7653 16.1531L14.6549 16.0633L10.4 11.8084L6.14515 16.0633C5.87178 16.3367 5.42828 16.3367 5.15492 16.0633C4.88155 15.7899 4.88155 15.3464 5.15492 15.0731L9.4098 10.8182L5.15492 6.5633L5.06507 6.45295C4.88597 6.18128 4.91584 5.81214 5.15492 5.57307C5.39399 5.33399 5.76313 5.30413 6.0348 5.48322L6.14515 5.57307L10.4 9.82795L14.6549 5.57307Z" fill="currentColor"/></svg>';
    close.addEventListener("click", onClose);
    container.append(header, close);
    return header;
  }
  function trapFocus(getContainer, { onClose, isBlocked = () => false }) {
    const controller = new AbortController();
    const stop = () => { controller.abort(); signal.removeEventListener("abort", stop); };
    signal.addEventListener("abort", stop, { once:true });
    document.addEventListener("keydown", event => {
      const container = getContainer();
      if (!container || isBlocked()) return;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation(); onClose(); return;
      }
      if (event.key !== "Tab") return;
      const controls = [...container.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')]
        .filter(node => !node.closest("[inert]") && node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); container.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === container)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container)) {
        event.preventDefault(); first.focus();
      }
    }, { signal:controller.signal, capture:true });
    return stop;
  }
  return { heading, trapFocus };
}
