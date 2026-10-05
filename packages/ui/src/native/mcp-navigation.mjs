// MCP 原生 railIcons 默认与选中共用资源；只更换 mask 图片，颜色与交互仍归原生节点。
export function installMcpNavigationIcons(signal, nativeRail, {server, pluginId, icons}) {
  const resources = new Map(icons.map(icon => [icon.tool,icon]));
  const snapshots = new Map();
  function restore(image, state) {
    if (image.getAttribute('href') !== state.applied) return;
    if (state.original === null) image.removeAttribute('href');
    else image.setAttribute('href',state.original);
  }
  function identity(node) {
    const item = nativeRail.item(node);
    const entry = item?.railIcons?.default?.props?.entry;
    if (!entry || !(entry.source?.server === server || (pluginId != null && entry.source?.pluginId === pluginId))) return null;
    let tool;
    try {tool = decodeURIComponent(entry.path.split('/').at(-1));} catch {return null;}
    const resource = resources.get(tool);
    if (!resource?.default || !resource.selected) return null;
    return {key:entry.path,resource};
  }
  function sync() {
    const owned = new Set();
    for (const node of document.querySelectorAll('[data-app-navigation-rail] [data-sidebar-destination^="mcp:"]')) {
      const owner = identity(node);
      if (!owner) continue;
      const image = node.querySelector('svg defs mask image');
      if (!image) continue; // 原生刷新状态显示 spinner 时没有图标 mask。
      owned.add(image);
      let state = snapshots.get(image);
      if (state && state.key !== owner.key) {
        restore(image,state);snapshots.delete(image);state = null;
      }
      const current = image.getAttribute('href');
      if (!state) {state = {key:owner.key,original:current,applied:null};snapshots.set(image,state);}
      else if (current !== state.applied) state.original = current;
      const selected = node.getAttribute('aria-current') === 'page'
        || (node.hasAttribute('data-selected') && node.getAttribute('data-selected') !== 'false');
      const next = selected ? owner.resource.selected : owner.resource.default;
      state.applied = next;
      if (current !== next) image.setAttribute('href',next);
    }
    for (const [image,state] of snapshots) if (!owned.has(image)) {
      restore(image,state);snapshots.delete(image);
    }
  }
  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,
    attributeFilter:['href','aria-current','data-selected','data-sidebar-destination']});
  const cleanup = () => {observer.disconnect();for (const [image,state] of snapshots) restore(image,state);snapshots.clear();};
  signal.addEventListener('abort',cleanup,{once:true});
  if (signal.aborted) cleanup(); else sync();
  return cleanup;
}
