// 依照原生 breadcrumb 的依赖角色查找公开模块，不绑定产物 hash 或短变量名。
export async function loadFileNavigationModules({read = async url => { const response = await fetch(url); if (!response.ok) throw new Error('file-navigation-source-unavailable'); return response.text(); }, load = url => import(url)} = {}) {
  const urls = [...document.querySelectorAll('link[rel="modulepreload"],script[src]')].map(n => n.href || n.src);
  const breadcrumbUrl = urls.find(url => /\/review-file-source-breadcrumb-[^/]+\.js$/.test(url));
  const mainUrl = urls.find(url => /\/app-main-[^/]+\.js$/.test(url));
  if (!breadcrumbUrl || !mainUrl) throw new Error('file-navigation-modules-unavailable');
  const imports = (source, url) => {
    const result = new Map();
    for (const match of source.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g))
      for (const entry of match[1].split(',')) {
        const parts = entry.trim().split(/\s+as\s+/);
        result.set(parts.at(-1), { name: parts[0], url: new URL(match[2], url).href });
      }
    return result;
  };
  const binding = async (map, name) => {
    const value = map.get(name);
    if (!value) throw new Error('file-navigation-dependency-unavailable');
    return (await load(value.url))[value.name];
  };
  const source = await read(breadcrumbUrl), deps = imports(source, breadcrumbUrl);
  const treeUrl = [...deps.values()].find(v => /\/base-file-tree-/.test(v.url))?.url;
  const queryUrl = [...deps.values()].find(v => /\/workspace-directory-entries-query-/.test(v.url))?.url;
  if (!treeUrl || !queryUrl) throw new Error('file-navigation-contract-changed');
  const [treeSource, querySource, main] = await Promise.all([read(treeUrl), read(queryUrl), read(mainUrl)]);
  const [treeModule, queryModule] = await Promise.all([load(treeUrl), load(queryUrl)]);
  for (const module of [treeModule, queryModule])
    for (const value of Object.values(module))
      if (typeof value === 'function' && /^function ([\w$]+)\(\)\{return\(\1=/.test(String(value))) value();
  const Tree = Object.values(treeModule).find(value => typeof value === 'function' && String(value).includes('contextMenuEnabled:'));
  const reactOwner = treeSource.match(/\(0,([\w$]+)\.useState\)/)?.[1];
  const reactFactory = reactOwner && treeSource.match(new RegExp(`\\b${reactOwner}=([\\w$]+)\\(\\)`))?.[1];
  const rootOwner = main.match(/\(0,([\w$]+)\.createRoot\)/)?.[1];
  const rootFactory = rootOwner && main.match(new RegExp(`\\b${rootOwner}=([\\w$]+)\\(\\)`))?.[1];
  const requestName = querySource.match(/queryFn:\(\{signal:[\w$]+\}\)=>([\w$]+)\(`workspace-directory-entries`/)?.[1];
  const directoryName = querySource.match(/queryFn:\(\{signal:[\w$]+\}\)=>([\w$]+)\([\w$]+,[\w$]+\)/)?.[1];
  const [react, dom, directoryRequest] = await Promise.all([
    binding(imports(treeSource, treeUrl), reactFactory),
    binding(imports(main, mainUrl), rootFactory),
    binding(imports(querySource, queryUrl), requestName ?? directoryName),
  ]);
  // 新版 query 将目录读取委托给 workspaceFiles.listDirectory，参数和取消信号保持原生归属。
  const request = requestName ? directoryRequest : (_method, {params, signal}) => directoryRequest(params, signal);
  if (typeof directoryRequest !== 'function') throw new Error('file-navigation-directory-unavailable');
  const React = react(), ReactDOM = dom();
  if (!Tree || !React.createElement || !ReactDOM.createRoot || typeof request !== 'function')
    throw new Error('file-navigation-components-unavailable');
  const sharedUrl = [...imports(treeSource, treeUrl).values()].find(value => /\/app-shared-/.test(value.url))?.url;
  const shared = sharedUrl && await load(sharedUrl);
  const folder = shared && Object.values(shared).find(value => value?.name === 'folder-light-16');
  if (!folder?.canvas?.viewBox || typeof folder.body !== 'string')
    throw new Error('file-navigation-folder-icon-unavailable');
  // 分列导航没有纵向展开状态；通过原生样式入口使用固定的原生文件夹图标。
  const folderImage = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${folder.canvas.viewBox}">${folder.body}</svg>`)}")`;
  const columnStyles = `
    /* 原生树的逻辑焦点也响应鼠标；描边仅保留给键盘可见焦点。 */
    [data-type="item"]:not(:focus-visible)::before { outline:none; }
    [data-item-type="folder"] [data-item-section="icon"] { width:16px; height:16px; transform:none; }
    [data-item-type="folder"] [data-item-section="icon"] svg { display:none; }
    [data-item-type="folder"] [data-item-section="icon"]::before {
      content:""; display:block; width:16px; height:16px; background:currentColor;
      mask:${folderImage} center / contain no-repeat;
    }
  `;
  return { Tree, React, ReactDOM, request, columnStyles };
}
