// 使用当前编辑器所属的原生 CodeMirror 实例，避免引入第二套编辑器依赖。
export async function loadMarkdownListAPI(view) {
  const links = [...document.querySelectorAll('link[rel="modulepreload"]')];
  for (const link of links) {
    if (!/\/dist-[\w-]+\.js$/.test(link.href)) continue;
    const exports = Object.values(await import(link.href));
    if (!exports.includes(view.constructor)) continue;
    const Decoration = exports.find((value) => value?.line && value?.replace && value?.mark);
    const ViewPlugin = exports.find((value) => value?.fromClass && value?.define);
    const StateEffect = exports.find((value) => value?.appendConfig && value?.reconfigure);
    const Compartment = exports.find(
      (value) => value?.prototype?.reconfigure && value?.prototype?.of && value?.prototype?.get,
    );
    const WidgetType = exports.find(
      (value) => value?.prototype?.eq && value?.prototype?.ignoreEvent && value?.prototype?.updateDOM,
    );
    const StateField = exports.find(
      (value) =>
        value?.define && value?.prototype?.slot && value?.prototype?.init && value?.prototype?.create,
    );
    const Prec = exports.find((value) => value?.highest && value?.lowest && value?.high);
    if (Decoration && ViewPlugin && StateEffect && Compartment && WidgetType && Prec && StateField)
      return { Decoration, ViewPlugin, StateEffect, Compartment, WidgetType, Prec, StateField };
  }
  throw new Error('native-markdown-list-api-unavailable');
}
