export function installPage(signal, ui, native) {
  const pages = new Map();
  signal.addEventListener("abort", () => { for (const lease of pages.values()) lease.release(); pages.clear(); }, { once:true });
  return {
    page(node, { transparent = false, sidebar = "inherit" } = {}) {
      if (sidebar === "none" && !pages.has(node)) pages.set(node, native.standalone());
      ui.surface(node, "page", { variant:transparent ? "transparent" : "opaque" });
      return ui.layer(node, "page");
    },
    releasePage(node, options) {
      pages.get(node)?.release(options);
      pages.delete(node);
    },
  };
}
