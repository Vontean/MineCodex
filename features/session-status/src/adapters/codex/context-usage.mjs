// 原生 atom、scope 和 bundle 字段不进入状态栏呈现层。
export function createContextUsageAdapter(signal, codex, onChange, loadFamily = null) {
  let family=null, thread=null, composer=null, unsubscribe=null;
  const empty = () => ({ contextUsedTokens:null, contextWindow:null, contextPercent:null });
  let published = null;
  function publish(value) {
    // 未就绪时重复连接不能重绘，否则 DOM 监听会在微任务中自循环。
    if (published && Object.keys(value).every(key => published[key] === value[key])) return;
    published = value;
    onChange(value);
  }
  function disconnect() { unsubscribe?.(); unsubscribe=null; }
  function connect(id, element) {
    if (thread === id && composer === element && unsubscribe) return;
    disconnect(); thread=id; composer=element; publish(empty());
    if (!id || !family || !element || signal.aborted) return;
    const props=codex.props(element, p => p.value instanceof Map && [...p.value.values()].some(node => node?.token?.__scopeBrand === 'AppScope'));
    const chain=props?.value, node=chain && [...chain.values()].find(node => node?.token?.__scopeBrand === 'AppScope');
    if (!node) { codex.report("context-usage",false,"app-scope-unavailable"); return; }
    try {
      const atom=family.resolve(node,chain,id).resolve(node,chain);
      const update=()=>{
        if (signal.aborted || thread !== id || composer !== element) return;
        const usage=node.store.get(atom), window=usage?.modelContextWindow, total=usage?.last?.totalTokens;
        const valid=Number.isFinite(window) && window > 0 && Number.isFinite(total) && total >= 0;
        const used=valid ? Math.min(total,window) : null;
        publish(valid ? {contextUsedTokens:used,contextWindow:window,contextPercent:Math.round(used/window*100)} : empty());
      };
      unsubscribe=node.store.sub(atom,update); update(); codex.report("context-usage",true);
    } catch { codex.report("context-usage",false,"atom-contract-unavailable"); }
  }
  async function discover() {
    if (loadFamily) return loadFamily();
    const url=[...document.querySelectorAll('link[rel=modulepreload]')].map(link=>link.href).find(url=>/\/app-shared-[^/]+\.js(?:$|\?)/.test(url));
    if (!url) throw new Error("context-bundle-unavailable");
    const source=await (await fetch(url,{signal})).text();
    const local=source.match(/([\w$]+)=[\w$]+\(\(\{latestTokenUsageInfo:/)?.[1];
    const exported=[...source.matchAll(/([\w$]+) as ([\w$]+)/g)].find(match=>match[1]===local)?.[2];
    if (!exported) throw new Error("context-export-unavailable");
    return (await import(url))[exported];
  }
  void discover().then(value=>{ if (!signal.aborted) { family=value; connect(thread,composer); } })
    .catch(()=>codex.report("context-usage",false,"context-capability-unavailable"));
  signal.addEventListener('abort',disconnect,{once:true});
  return { connect, dispose:disconnect };
}
