export function markdownMermaidSource(fence) {
  const match = String(fence || '').match(/^(`{3,}|~{3,})mermaid[ \t]*\r?\n([\s\S]*?)\r?\n\1\s*$/);
  return match && match[2].length <= 50000 ? match[2] : null;
}

// 依赖与渲染脚本按文档只编译一次：图表帧按 URL 取用同一份脚本，避免逐帧复制源码、
// 重复建 Blob 与重复编译。URL 由引用计数持有，最后一个预览释放时回收。
export function createQvResources(resources) {
  if (!resources.qvTemplate?.script || !resources.qvDependencies) throw new Error('qv-resources-unavailable');
  const store = (globalThis.__mcxQvScripts ??= new Map());
  const acquire = (text) => {
    const held = store.get(text);
    if (held) { held.refs += 1; return held.url; }
    const entry = { url: URL.createObjectURL(new Blob([text], { type: 'text/javascript' })), refs: 1 };
    store.set(text, entry);
    return entry.url;
  };
  const release = (url) => {
    for (const [text, entry] of store) {
      if (entry.url !== url) continue;
      if (--entry.refs > 0) return;
      URL.revokeObjectURL(entry.url);
      store.delete(text);
      return;
    }
  };
  const dependencies = acquire(resources.qvDependencies);
  const renderer = acquire(resources.qvTemplate.script);
  return { template: resources.qvTemplate, dependencies, renderer,
    dispose() { release(dependencies); release(renderer); } };
}

export function createQvFrame(source, assets, theme, onHeight, onReady, onEscape) {
  const frame = document.createElement('iframe'), token = crypto.randomUUID();
  frame.className = 'mcx-reading-qv-frame';
  frame.title = document.documentElement.lang.startsWith('zh') ? 'QV Mermaid 图表' : 'QV Mermaid diagram';
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  frame.style.height = '240px';
  let disposed = false, height = 240;
  const timeout = setTimeout(() => { if (!disposed) onReady('error'); }, 30000);
  const config = { source, title: '', descriptions: {}, icons: 'auto', navigation: 'auto' };
  const encode = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
  const bootstrap = `const token=${encode(token)};window.__mcxDiagramConfig=${encode(config)};window.openai={displayMode:'inline',maxHeight:innerHeight};
const send=()=>{const root=document.querySelector('.qv-mermaid');parent.postMessage({type:'mcx-qv',token,state:root.dataset.state,height:Math.ceil(root.offsetHeight)},'*');};
const theme=value=>{for(const [key,v]of Object.entries(value.tokens))document.documentElement.style.setProperty(key,v);document.documentElement.style.colorScheme=value.scheme;document.body.style.fontFamily=value.font;document.body.style.fontSize=value.size;};theme(${encode(theme)});
const load=value=>new Promise((resolve,reject)=>{const url=String(value);if(!/^blob:/.test(url))return reject(new Error('QV runtime unavailable'));const script=document.createElement('script');script.src=url;script.onload=()=>resolve();script.onerror=()=>reject(new Error('QV runtime unavailable'));document.body.append(script);});
window.addEventListener('message',async event=>{const data=event.data;if(event.source!==parent||data?.token!==token)return;if(data.type==='boot'){try{await load(data.dependencies);await load(data.renderer);}catch(error){const root=document.querySelector('.qv-mermaid');root.dataset.state='error';root.querySelector('.qv-notice').hidden=false;root.querySelector('.qv-notice').textContent=error.message;send();}}if(data.type==='theme')theme(data.theme);if(data.type==='mode'){window.openai={displayMode:data.mode,maxHeight:innerHeight};dispatchEvent(new CustomEvent('openai:set_globals',{detail:{globals:window.openai}}));}});
document.addEventListener('qv:ready',()=>queueMicrotask(send));document.addEventListener('keydown',event=>{if(event.key==='Escape')parent.postMessage({type:'mcx-qv-escape',token},'*');});
new ResizeObserver(send).observe(document.querySelector('.qv-mermaid'));parent.postMessage({type:'mcx-qv-bootstrap',token},'*');`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';script-src blob: 'unsafe-inline';style-src 'unsafe-inline';img-src data: blob:;font-src data:;connect-src 'none'"><style>html,body{margin:0;overflow:hidden}body{color:var(--foreground);background:var(--background);font-size:14px;line-height:1.5}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}button,input{font:inherit}.scope-toggle{display:flex;align-items:center;gap:8px}.form-check-input{accent-color:var(--viz-series-1)}</style></head><body>${assets.template.markup}<script>${bootstrap}</script></body></html>`;
  frame.srcdoc = html;
  function message(event) {
    if (disposed || event.source !== frame.contentWindow || event.data?.token !== token) return;
    if (event.data.type === 'mcx-qv-bootstrap') {
      frame.contentWindow.postMessage({type:'boot',token,dependencies:assets.dependencies,renderer:assets.renderer},'*');
      return;
    }
    if (event.data.type === 'mcx-qv-escape') { onEscape(); return; }
    if (event.data.type !== 'mcx-qv' || event.data.state === 'loading') return;
    clearTimeout(timeout);
    onReady(event.data.state);
    const next = event.data.height;
    if (Number.isFinite(next) && next > 0 && next <= 100000 && next !== height) {
      height = next; onHeight(next);
    }
  }
  window.addEventListener('message', message);
  return { frame, get height() { return height; },
    mode(mode) { frame.contentWindow?.postMessage({ type: 'mode', token, mode }, '*'); },
    theme(theme) { frame.contentWindow?.postMessage({ type: 'theme', token, theme }, '*'); },
    dispose() { disposed = true; clearTimeout(timeout); window.removeEventListener('message', message); frame.remove(); } };
}

export function readQvTheme(element) {
  const style = getComputedStyle(element), get = (name) => style.getPropertyValue(name).trim();
  const background = get('--mcx-color-token-main-surface-primary'), foreground = get('--mcx-color-text-foreground');
  const tokens = { '--background': background, '--foreground': foreground,
    '--muted': get('--mcx-color-token-bg-secondary'), '--muted-foreground': get('--mcx-color-text-foreground-secondary'),
    '--border': get('--mcx-color-border'), '--popover': background, '--popover-foreground': foreground,
    '--secondary': get('--mcx-color-token-bg-secondary'), '--secondary-foreground': foreground };
  const colors = ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ec4899','#06b6d4'];
  colors.forEach((color, index) => tokens[`--viz-series-${index+1}`] = get(`--viz-series-${index+1}`) || color);
  return { tokens, scheme: style.colorScheme, font: style.fontFamily, size: style.fontSize };
}
