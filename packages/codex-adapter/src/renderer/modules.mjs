// 只沿原生应用入口链读取模块引用；预加载标签不是完整的模块清单。
export async function findCodexModule(name, {read = null, signal, all = false, waitForEntry = false, via = []} = {}) {
  const links = () => [...document.querySelectorAll('link[rel="modulepreload"],script[src]')]
    .map(node => node.href || node.src).filter(Boolean);
  const entry = url => /\/(?:index|app-(?:main|initial))-[^/]+\.js(?:$|\?)/.test(url);
  let urls=links();
  signal?.throwIfAborted();
  if (waitForEntry && !urls.some(entry)) {
    await new Promise((resolve,reject) => {
      const cleanup=()=>{observer.disconnect();signal?.removeEventListener('abort',abort);};
      const abort=()=>{cleanup();reject(signal.reason);};
      const check=()=>{if(links().some(entry)){cleanup();resolve();}};
      const observer=new MutationObserver(check);
      observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','href','rel']});
      signal?.addEventListener('abort',abort,{once:true});
      if(signal?.aborted) abort(); else check();
    });
    urls=links();
  }
  const matches=url=>new URL(url).pathname.split('/').at(-1)?.startsWith(`${name}-`)
    && /\.js(?:$|\?)/.test(url);
  const found=new Set(urls.filter(matches));
  if (found.size && !all) return [...found][0];
  const core=url=>/\/(?:index|app-(?:main|initial|primary|runtime|shared))-[^/]+\.js(?:$|\?)/.test(url)
    || via.some(role=>new URL(url).pathname.split('/').at(-1)?.startsWith(`${role}-`));
  const queue=urls.filter(core).sort((a,b)=>Number(a.includes('/app-shared-'))-Number(b.includes('/app-shared-')));
  const visited=new Set();
  const source=read ?? (async url=>{
    const response=await fetch(url,{signal});
    if(!response.ok) throw new Error('native-module-source-unavailable');
    return response.text();
  });
  while(queue.length) {
    signal?.throwIfAborted();
    const url=queue.shift();
    if(visited.has(url)) continue;
    visited.add(url);
    const text=await source(url);
    signal?.throwIfAborted();
    for(const match of text.matchAll(/["'`](\.\/[\w.-]+\.js)["'`]/g)) {
      const dependency=new URL(match[1],url).href;
      if(matches(dependency)) {found.add(dependency);if(!all)return dependency;}
      if(core(dependency) && !visited.has(dependency))queue.push(dependency);
    }
  }
  return all ? [...found] : null;
}

// 使用原生 lazy import 声明的 CSS 依赖，兼容 Vite 将语义样式名改成纯 hash。
export function codexModuleStyles(source, ownerUrl, moduleUrl) {
  const table=source.match(/\.f=\[([^\]]+)\]/)?.[1];
  if(!table)return [];
  const dependencies=JSON.parse(`[${table}]`);
  for(const match of source.matchAll(/import\(["'`]([^"'`]+)["'`]\)/g)) {
    if(new URL(match[1],ownerUrl).href!==moduleUrl)continue;
    const call=source.slice(match.index,source.indexOf('import.meta.url',match.index));
    const indices=call.match(/__vite__mapDeps\(\[([\d,]+)\]\)/)?.[1];
    if(!indices)return [];
    return [...new Set(indices.split(',').map(Number).map(index=>{
      const file=dependencies[index];
      if(typeof file!=='string')throw new Error('native-module-style-dependency-unavailable');
      return file;
    }).filter(file=>file.endsWith('.css')).map(file=>new URL(file,ownerUrl).href))];
  }
  return [];
}

// rspack 的入口公开原生 require；只读取已注册模块，不重新执行模块工厂。
export async function codexModuleRegistry({read = async url => (await fetch(url)).text(), load = url => import(url)} = {}) {
  for (const script of document.querySelectorAll('script[src]')) {
    const url = script.src;
    if (!url) continue;
    const source = await read(url);
    if (!/export\s*\{[^}]*\bas\s+__webpack_require__\b/.test(source)) continue;
    const runtime = (await load(url)).__webpack_require__;
    if (typeof runtime !== 'function' || !runtime.m || !runtime.c) throw new Error('native-module-registry-unavailable');
    const sourceOf = value => {
      try { return Function.prototype.toString.call(value); } catch { return ''; }
    };
    const entries = Object.entries(runtime.m).map(([id, factory]) => ({id, source:sourceOf(factory)}));
    const unique = (values, role) => {
      if (values.length !== 1) throw new Error(`Native module contract changed: ${role}`);
      return values[0];
    };
    const exportsOf = entry => {
      const cached = runtime.c[entry.id];
      if (!cached || cached.error) throw new Error('native-module-not-loaded');
      return cached.exports;
    };
    const module = (predicate, role) => unique(entries.filter(entry => predicate(entry.source)), role);
    const value = (entry, predicate, role) => unique(Object.values(exportsOf(entry)).filter(item => predicate(item, sourceOf(item))), role);
    const binding = (entry, reference) => {
      const [owner, ...properties] = reference.split('.');
      const escaped = owner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const id = entry.source.match(new RegExp(`(?:^|[^\\w$])${escaped}=[\\w$]+\\("([^"\\n]+)"\\)`))?.[1];
      if (!id) throw new Error('native-module-binding-unavailable');
      let result = exportsOf({id});
      for (const property of properties) result = result?.[property];
      if (result == null) throw new Error('native-module-export-unavailable');
      return result;
    };
    const lazy = async (entry, name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = entry.source.match(new RegExp(`[\\w$]+\\.e\\((\\d+)\\)\\.then\\([\\w$]+\\.bind\\([\\w$]+,"([^"\\n]+)"\\)\\)\\.then\\([\\w$]+=>\\(\\{default:[\\w$]+\\.${escaped}\\}\\)\\)`));
      if (!match) throw new Error('native-module-lazy-contract-unavailable');
      await runtime.e(Number(match[1]));
      const exports = runtime(match[2]);
      if (typeof exports[name] !== 'function') throw new Error('native-module-lazy-export-unavailable');
      return {id:match[2], source:sourceOf(runtime.m[match[2]])};
    };
    return {entries, module, value, binding, lazy, exports:exportsOf, sourceOf};
  }
  return null;
}
