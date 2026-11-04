import { findCodexModule, codexModuleRegistry } from '../renderer/modules.mjs';
// 使用当前编辑器所属的原生 CodeMirror 实例，避免引入第二套编辑器依赖。
export async function loadMarkdownListAPI(view) {
  const registry=await codexModuleRegistry();
  if (registry) return loadRspackMarkdownListAPI(registry,view);
  const urls=await findCodexModule('dist',{all:true});
  for (const url of urls) {
    const exports = Object.values(await import(url));
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


export function loadRspackMarkdownListAPI(registry,view) {
  const values=[...new Set(registry.entries.flatMap(entry=>{
    let exports;
    try {exports=Object.values(registry.exports(entry));} catch {return [];}
    return exports.includes(view.constructor)||exports.includes(view.state.constructor)?exports:[];
  }))];
  const requireRole=(predicate,role)=>{
    const matches=values.filter(predicate);
    if(matches.length!==1)throw new Error(`native-codemirror-${role}-unavailable`);
    return matches[0];
  };
  return {
    Decoration:requireRole(value=>value?.line&&value?.replace&&value?.mark,'decoration'),
    ViewPlugin:requireRole(value=>value?.fromClass&&value?.define,'view-plugin'),
    StateEffect:requireRole(value=>value?.appendConfig&&value?.reconfigure,'state-effect'),
    Compartment:requireRole(value=>value?.prototype?.reconfigure&&value?.prototype?.of&&value?.prototype?.get,'compartment'),
    WidgetType:requireRole(value=>value?.prototype?.eq&&value?.prototype?.ignoreEvent&&value?.prototype?.updateDOM,'widget'),
    StateField:requireRole(value=>value?.define&&value?.prototype?.slot&&value?.prototype?.init&&value?.prototype?.create,'state-field'),
    Prec:requireRole(value=>value?.highest&&value?.lowest&&value?.high,'precedence'),
  };
}
