import { createQvResources, createQvFrame, readQvTheme } from '../../mermaid/frame.mjs';
import { createQvLoading } from '../../mermaid/loading.mjs';
import { captureMarkdownProviders } from './providers.mjs';
import { createMarkdownMermaidControls } from './mermaid-viewer.mjs';

export function installMarkdownMermaid(view, api, native, codex, resources, onStatus = () => {}) {
  if (!Element.prototype.moveBefore) throw new Error('qv-state-preserving-move-unavailable');
  const { Decoration, StateField, StateEffect, Compartment, WidgetType, Prec } = api;
  const assets = createQvResources(resources), mounted = new Set();
  const Controls = createMarkdownMermaidControls(native);
  const withProviders = captureMarkdownProviders(view.dom, codex);
  let disposed = false;
  const available = () => [...mounted].every(item => item.ready);
  const report = () => { if (!disposed) onStatus(available()); };
  class Diagram extends WidgetType {
    constructor(source) { super(); this.source = source; }
    eq(other) { return this.source === other.source; }
    toDOM() {
      const host = document.createElement('div'), slot = document.createElement('div'), actions = document.createElement('div');
      const status = document.createElement('div');
      const chinese = document.documentElement.lang.startsWith('zh');
      status.className = 'mcx-reading-qv-status'; status.setAttribute('role', 'status');
      status.setAttribute('aria-label', chinese ? '正在加载图表…' : 'Loading diagram…');
      host.className = 'mcx-reading-qv-widget'; slot.className = 'mcx-reading-qv-inline'; actions.className = 'mcx-reading-qv-actions';
      host.append(actions, slot); slot.append(status);
      const finishLoading = createQvLoading(status);
      const item = { host, slot, source:this.source, height:280, ready:false, expanded:false };
      slot.style.height = '280px';
      item.controller = createQvFrame(this.source, assets, readQvTheme(view.dom), height => {
        if (disposed || view.destroyed) return;
        if (item.expanded) {
          if (item.mode === 'actual') item.controller.frame.style.height = height + 'px';
          return;
        }
        item.height = height; slot.style.height = height + 'px';
        item.controller.frame.style.height = height + 'px'; view.requestMeasure();
      }, state => {
        finishLoading();
        status.removeAttribute('aria-label');
        item.ready = state === 'enhanced' || state === 'native';
        status.hidden = item.ready;
        if (!item.ready) status.textContent = chinese ? '图表加载失败，可复制源码查看。' : 'Diagram failed to load. Copy the source to inspect it.';
        item.controller.frame.style.visibility = item.ready ? '' : 'hidden';
        item.setReady?.(item.ready); report();
      }, () => item.close?.());
      item.controller.frame.style.visibility = 'hidden';
      slot.append(item.controller.frame);
      const root = native.ReactDOM.createRoot(actions);
      root.render(withProviders(native.React, native.React.createElement(Controls, {item})));
      item.dispose = () => { finishLoading(); root.unmount(); item.controller.dispose(); mounted.delete(item); report(); };
      host._mcxQv = item; mounted.add(item); report();
      return host;
    }
    destroy(host) { host._mcxQv?.dispose(); }
    ignoreEvent() { return true; }
  }
  function build(state) {
    const ranges = [];
    state.tree?.iterate({ enter(n) {
      if (n.name !== 'FencedCode') return;
      const node = n.node, info = node.getChild('CodeInfo');
      if (!info || state.sliceDoc(info.from, info.to).split(/\s/,1)[0] !== 'mermaid'
        || node.getChildren('CodeMark').length !== 2) return false;
      const source = node.getChildren('CodeText').map(n=>state.sliceDoc(n.from,n.to)).join('');
      if (source.length > 50000) return false;
      ranges.push(Decoration.replace({ block:true, widget:new Diagram(source) })
        .range(state.doc.lineAt(n.from).from, state.doc.lineAt(n.to).to));
      return false;
    } });
    return Decoration.set(ranges, true);
  }
  const field = StateField.define({ create:build, update(value,tr) {
    return tr.docChanged || tr.startState.tree !== tr.state.tree ? build(tr.state) : value;
  }, provide:field=>view.constructor.decorations.from(field) });
  const compartment = new Compartment();
  view.dispatch({ effects:StateEffect.appendConfig.of(compartment.of(Prec.highest(field))) });
  const themes = new MutationObserver(() => {
    if (disposed) return;
    const theme = readQvTheme(view.dom);
    for (const item of mounted) item.controller.theme(theme);
  });
  themes.observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});
  const cleanup = () => {
    if (disposed) return;
    disposed = true; themes.disconnect();
    if (!view.destroyed) view.dispatch({effects:compartment.reconfigure([])});
    for (const item of [...mounted]) item.dispose();
    assets.dispose();
  };
  cleanup.available = available;
  return cleanup;
}
