export function installAccountMenuEntry(signal, ui, native) {
  function accountMenuEntry({ label, icon, externalIcon, onOpen }) {
    const marker = "data-mcx-account-menu-entry";
    let node, anchor, entryBindings, opening = false;
    const bindings = new AbortController();
    function svg(source, template = null) {
      if (typeof source !== "string") source = source[Number(template.getAttribute("width"))];
      const result = new DOMParser().parseFromString(source, "image/svg+xml").documentElement;
      result.setAttribute("aria-hidden", "true");
      result.removeAttribute("role");
      result.removeAttribute("aria-labelledby");
      result.querySelectorAll("title, desc").forEach(n => n.remove());
      result.setAttribute("class", template?.getAttribute("class") ?? "icon-xs shrink-0");
      if (template) {
        // 原生 16/20px 图标由外层切换，品牌资源的 24px 不能覆盖它。
        for (const name of ["width", "height", "style"]) {
          const value = template.getAttribute(name);
          if (value == null) result.removeAttribute(name);
          else result.setAttribute(name, value);
        }
      }
      return result;
    }
    async function activate(event) {
      event?.preventDefault();
      event?.stopPropagation();
      if (opening) return;
      opening = true;
      const close = anchor.close;
      try { await onOpen(); close(); }
      catch (error) { console.warn("[MineCodex] Control panel could not open", error); window.alert(error.message); }
      finally { opening = false; }
    }
    function sync() {
      if (signal.aborted) return;
      const found = native.settings();
      if (!found) { entryBindings?.abort(); node?.remove(); node = null; anchor = null; return; }
      if (node?.isConnected && anchor.item === found.item) return;
      entryBindings?.abort();
      entryBindings = new AbortController();
      node?.remove();
      anchor = found;
      // 只修改脱离 React 的副本，保留原生 Settings 节点及事件。
      node = found.item.cloneNode(true);
      for (const element of [node, ...node.querySelectorAll("*")]) {
        for (const attr of [...element.attributes]) {
          if (attr.name === "id" || attr.name === "title" || attr.name.startsWith("aria-")
            || attr.name.startsWith("data-")) element.removeAttribute(attr.name);
        }
      }
      node.setAttribute(marker, "");
      node.setAttribute("role", "menuitem");
      node.tabIndex = -1;
      const [leading, title, trailing] = node.querySelector("div").children;
      // 保留紧凑/普通图标的原生容器及颜色、透明度和状态规则。
      for (const template of leading.querySelectorAll("svg")) template.replaceWith(svg(icon, template));
      title.textContent = label;
      // 右侧提示沿用原生 Help 箭头的 tertiary 色，不套左侧图标的透明度。
      trailing.style.color = "inherit";
      const external = svg(externalIcon);
      external.setAttribute("class", "icon-xs shrink-0 text-tertiary");
      trailing.replaceChildren(external);
      node.addEventListener("click", activate, { signal:entryBindings.signal });
      node.addEventListener("pointermove", () => node.focus({ preventScroll:true }), { signal:entryBindings.signal });
      found.item.after(node);
    }
    function keyboard(event) {
      if (!anchor || !node?.isConnected || !anchor.menu.contains(event.target)) return;
      const current = event.target.closest('[role="menuitem"]');
      let next;
      if (current === anchor.item && event.key === "ArrowDown") next = node;
      else if (current === node && event.key === "ArrowUp") next = anchor.item;
      else if (current === node && event.key === "ArrowDown") {
        const items = [...anchor.menu.querySelectorAll('[role="menuitem"]')];
        next = items[items.indexOf(node) + 1] ?? items[0];
      } else if (current === node && ["Enter", " "].includes(event.key)) { void activate(event); return; }
      if (next) { event.preventDefault(); event.stopImmediatePropagation(); next.focus({ preventScroll:true }); }
    }
    document.addEventListener("keydown", keyboard, { capture:true, signal:bindings.signal });
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { childList:true, subtree:true });
    const dispose = () => { observer.disconnect(); bindings.abort(); entryBindings?.abort(); node?.remove(); node = null; anchor = null; };
    signal.addEventListener("abort", dispose, { once:true });
    sync();
    return { sync, dispose };
  }
  return { accountMenuEntry };
}
