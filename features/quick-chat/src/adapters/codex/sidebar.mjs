import { findCodexModule } from '../../../../../packages/codex-adapter/src/renderer/modules.mjs';
export async function loadQuickChatSidebarIcon(signal) {
  const initialUrl = await findCodexModule('app-initial',{signal});
  if (!initialUrl) throw new Error('quick-chat-icon-module-unavailable');
  const initial = await (await fetch(initialUrl,{signal})).text();
  const file = initial.match(/["'`]\.\/((?:quick-chat-floating-surface|floating-chat-surface)-[\w-]+\.js)["'`]/)?.[1];
  const url = file ? new URL(file,initialUrl).href : await findCodexModule('floating-chat-surface',{signal,via:['quick-chat-window','page-codex-quick-chat-window','content-chat-surface']}) ?? await findCodexModule('quick-chat-floating-surface',{signal});
  if (!url) throw new Error('quick-chat-icon-module-unavailable');
  const source = await (await fetch(url,{signal})).text();
  // 原生 Restore 在未传 minimizedIcon 时使用的默认聊天图标。
  const local = source.match(/children:[\w$]+\?\?\(0,[\w$]+\.jsx\)\(([\w$]+),\{\}\)/)?.[1];
  for (const match of source.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g))
    for (const entry of match[1].split(',')) {
      const parts = entry.trim().split(/\s+as\s+/);
      if (parts.at(-1) !== local) continue;
      const icon = (await import(new URL(match[2],url).href))[parts[0]];
      if (typeof icon?.createElement !== 'function') break;
      return icon;
    }
  throw new Error('quick-chat-icon-contract-unavailable');
}

export function createQuickChatSidebarAdapter(codex) {
  return {read() {
    for (const row of document.querySelectorAll('#app-shell-sidebar button')) {
      if (!row.checkVisibility({visibilityProperty:true})) continue;
      const item = codex.props(row, p => p.animatedIcon === 'sidebar-new-chat' && p.excludeFromNavigation === true, 8);
      const mode = item && codex.props(row, p => typeof p.sidebarMode === 'string', 30)?.sidebarMode;
      const svg = mode === 'codex' && row.querySelector('svg');
      const slot = svg && svg.closest('.icon-leading-slot');
      if (svg && slot && row.parentElement) return {row, container:row.parentElement,svg,slot};
    }
    return null;
  }};
}
