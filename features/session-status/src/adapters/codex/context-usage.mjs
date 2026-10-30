export function contextUsageExport(source) {
  // 新版从宿主感知的 tokenUsageInfo selector 派生 thread atom family。
  const selector = source.match(/([\w$]+)=[\w$]+\(([`"'])tokenUsageInfo\2\),([\w$]+)=[\w$]+\(/);
  const local = selector?.[3] ?? source.match(/([\w$]+)=[\w$]+\(\(\{latestTokenUsageInfo:/)?.[1];
  return local ? [...source.matchAll(/([\w$]+) as ([\w$]+)/g)].find(match => match[1] === local)?.[2] ?? null : null;
}

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
    const urls=[...document.querySelectorAll('link[rel=modulepreload],script[src]')].map(node=>node.href || node.src);
    const matching = pattern => urls.filter(url=>pattern.test(url));
    const queue=[...matching(/\/app-initial-[^/]+\.js(?:$|\?)/),
      ...matching(/\/app-shared-[^/]+\.js(?:$|\?)/),
      ...matching(/\/(?:app-main|index)-[^/]+\.js(?:$|\?)/)];
    if (!queue.length) throw new Error("context-bundle-unavailable");
    const visited=new Set();
    while (queue.length) {
      const url=queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);
      const source=await (await fetch(url,{signal})).text();
      const exported=contextUsageExport(source);
      if (exported) return (await import(url))[exported];
      // modulepreload 只是优化提示；沿真实入口引用发现不再预加载的原生状态模块。
      const references=[...source.matchAll(/["'`](\.\/app-(?:initial|main|shared)-[^/"'`]+\.js)["'`]/g)]
        .map(match=>new URL(match[1],url).href);
      queue.push(...references);
    }
    throw new Error("context-export-unavailable");
  }
  void discover().then(value=>{ if (!signal.aborted) { family=value; connect(thread,composer); } })
    .catch(()=>codex.report("context-usage",false,"context-capability-unavailable"));
  signal.addEventListener('abort',disconnect,{once:true});
  return { connect, dispose:disconnect };
}
