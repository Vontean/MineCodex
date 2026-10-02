export function installAccountMenuEntry(signal, ui, native) {
  function accountMenuEntry({ label, icon, externalIcon, onOpen }) {
    const marker = "data-mcx-account-menu-entry";
    let node, anchor, entryBindings, opening = false;
    const bindings = new AbortController();
    function svg(source, template = null) {
      const result = new DOMParser().parseFromString(source, "image/svg+xml").documentElement;
      result.setAttribute("aria-hidden", "true");
      result.removeAttribute("role");
      result.removeAttribute("aria-labelledby");
      result.querySelectorAll("title, desc").forEach(n => n.remove());
      result.setAttribute("class", template?.getAttribute("class") ?? "icon-xs shrink-0");
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
      leading.replaceChildren(svg(icon, leading.querySelector("svg")));
      title.textContent = label;
      trailing.replaceChildren(svg(externalIcon));
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
