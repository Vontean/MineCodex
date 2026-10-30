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
