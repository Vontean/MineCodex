export function installPage(signal, ui) {
  return {
    page(node, { transparent = false } = {}) {
      ui.surface(node, "page", { variant:transparent ? "transparent" : "opaque" });
      return ui.layer(node, "page");
    },
  };
}
