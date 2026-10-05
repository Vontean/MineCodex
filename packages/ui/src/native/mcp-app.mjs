// Codex 26.930：GlobalView 的重复标题由宿主生成，不能从 iframe 控制。
export function installMcpAppChrome(signal, codex, {server,pluginId}) {
  const headers = new Map();
  function restore(header, hidden) {
    if (header.hasAttribute('data-mcx-hidden-app-header')) {
      header.hidden = hidden;
      header.removeAttribute('data-mcx-hidden-app-header');
    }
  }
  function sync() {
    const owned = new Set();
    for (const surface of document.querySelectorAll('[data-mcp-extension-surface]')) {
      const owner = codex.props(surface, props => props.source?.server != null);
      if (!owner || !(owner.source.server === server || (pluginId != null && owner.source.pluginId === pluginId))) continue;
      const header = surface.querySelector(':scope > [data-mcp-extension-header]');
      if (!header) continue;
      owned.add(header);
      if (!headers.has(header)) headers.set(header, header.hidden);
      header.setAttribute('data-mcx-hidden-app-header','');
      header.hidden = true;
    }
    for (const [header,hidden] of headers) if (!owned.has(header)) {
      restore(header,hidden);headers.delete(header);
    }
  }
  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  sync();
  const cleanup=()=>{observer.disconnect();for (const [header,hidden] of headers) restore(header,hidden);headers.clear();};
  signal.addEventListener('abort',cleanup,{once:true});
  return cleanup;
}
