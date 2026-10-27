import {quickChatLifecycleActions, quickChatScope} from "./lifecycle.mjs";
// 通过原生能力检查与已有会话分支定位打开动作，不依赖构建哈希或压缩名称。
export function quickChatOpenExport(source) {
  const match = source.match(/function ([\w$]+)\(([\w$]+),[\w$]+=\{\}\)\{if\(!\2\.get\([\w$]+,\{name:[`"']chatgpt\.quick-chat[`"']\}\)\.isCapable\)return;let [\w$]+=\2\.get\([\w$]+\),[\w$]+=\2\.get\([\w$]+\);if\(/);
  if (!match) throw new Error('quick-chat-open-contract-unavailable');
  const escaped = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const name = source.slice(source.lastIndexOf('export{')).match(new RegExp(`(?:\\{|,)${escaped} as ([\\w$]+)(?:,|\\})`))?.[1];
  if (!name) throw new Error('quick-chat-open-export-unavailable');
  return name;
}

// 新建和恢复共用原生打开状态；退出动画残留的 DOM 不代表会话仍打开。
export function quickChatLifecycleExports(source) {
  const open = quickChatOpenExport(source);
  const exports = source.slice(source.lastIndexOf('export{'));
  const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const local = exports.match(new RegExp(`(?:\\{|,)([\\w$]+) as ${escaped(open)}(?:,|\\})`))?.[1];
  const start = source.indexOf(`function ${local}(`);
  const body = source.slice(start, source.indexOf('function ', start + 9));
  const create = body.match(/if\([\w$]+==null\)\{([\w$]+)\([\w$]+,[\w$]+\);return\}/)?.[1];
  const state = body.match(/[\w$]+\.get\(([\w$]+)\)\|\|/)?.[1];
  const exportOf = name => name && exports.match(new RegExp(`(?:\\{|,)${escaped(name)} as ([\\w$]+)(?:,|\\})`))?.[1];
  const createExport = exportOf(create), openState = exportOf(state);
  if (!createExport || !openState) throw new Error('quick-chat-lifecycle-contract-unavailable');
  // 冷启动时状态 atom 也可能尚未初始化，定位其所属的原生 once 初始化器。
  const assignment = source.search(new RegExp(`(?:[,;{])${escaped(state)}=[\\w$]+\\([\\w$]+,!1\\)`));
  const initializer = assignment < 0 ? null : source.slice(source.lastIndexOf('function ', assignment), assignment + 1)
    .match(/^function ([\w$]+)\(\)\{return\(\1=[\w$]+\(\(\(\)=>\{/);
  const initialize = exportOf(initializer?.[1]);
  return {open, create:createExport, openState, ...(initialize ? {initialize} : {})};
}

// 命令目录是懒初始化导出；按命令定义识别，不能要求数组已经初始化。
export function quickChatNativeCommand(source) {
  const ids = new Set([...source.matchAll(/\{id:[`"']([\w$.-]+)[`"'],titleIntlId:[`"']codex\.command\.[^`"']+[`"']/g)].map(match => match[1]));
  if (!ids.has('temporaryChat') || !ids.has('newTask')) throw new Error('quick-chat-command-catalog-unavailable');
  return ids.has('quickChat');
}

export function installQuickChatShortcut(signal, codex, discover = null) {
  const windows = navigator.platform.startsWith('Win');
  let bindings = null, disposed = false, pendingFocus = null, stopWaiting = null;
  function activateExisting(minimize = false) {
    // 原生恢复按钮同时恢复 presentation、取消最小化并聚焦输入框。
    for (const button of document.querySelectorAll('button')) {
      if (!button.checkVisibility({visibilityProperty:true})) continue;
      const floating = codex.props(button, p => typeof p.isMinimized === 'boolean' && typeof p.onMinimizedChange === 'function' && typeof p.onPresentationChange === 'function');
      if (!floating?.isMinimized || floating.isHidden) continue;
      const restore = codex.props(button, p => p.uniform === true && p.size === 'composer' && typeof p.onClick === 'function'
        && typeof p.onPointerEnter === 'function' && typeof p.onPointerDown === 'function' && typeof p.onKeyDown === 'function');
      if (!restore) continue;
      button.click();
      return true;
    }
    for (const surface of document.querySelectorAll('[data-floating-chat-surface]')) {
      if (surface.closest('[hidden], [inert], [aria-hidden="true"]')) continue;
      const floating = codex.props(surface, p => typeof p.isMinimized === 'boolean' && typeof p.onMinimizedChange === 'function' && typeof p.onPresentationChange === 'function');
      if (!floating || floating.isMinimized || floating.isHidden) continue;
      const editable = surface.querySelector('[data-chatgpt-composer] [contenteditable="true"]');
      if (!editable?.checkVisibility({visibilityProperty:true})) continue;
      if (minimize) { pendingFocus=null; floating.onMinimizedChange(true); }
      else editable.focus({preventScroll:true});
      return true;
    }
    return false;
  }
  function sessionId(surface) { return codex.props(surface,p=>p.session?.conversationId)?.session?.conversationId; }
  function focusNew() {
    if (!pendingFocus || disposed || signal.aborted) return;
    if (!bindings.isOpen(pendingFocus.scope)) { pendingFocus=null; return; }
    for (const surface of document.querySelectorAll('[data-floating-chat-surface]')) {
      const id=sessionId(surface);
      if (!id || pendingFocus.previous.has(id) || surface.closest('[hidden], [inert], [aria-hidden="true"]')) continue;
      const editable=surface.querySelector('[data-chatgpt-composer] [contenteditable="true"]');
      if (!editable?.checkVisibility({visibilityProperty:true})) continue;
      pendingFocus=null;
      editable.focus({preventScroll:true});
      return;
    }
  }
  function context() {
    for (const button of document.querySelectorAll('button[aria-haspopup="menu"]')) {
      if (!button.checkVisibility({visibilityProperty:true})) continue;
      const picker = codex.props(button, p => typeof p.onModeSelect === 'function' && typeof p.mode === 'string', 80);
      // 原生 ChatGPT 也使用 work 路由，具体产品由 workModeAccess 区分。
      if (picker?.mode !== 'codex' && !(picker?.mode === 'work' && picker.workModeAccess === 'chatgpt')) continue;
      const scope=quickChatScope(codex,button);
      if (scope) return scope;
    }
    // 侧栏可能卸载；从仍挂载的窗口内容取当前 scope，模式由原生状态判定。
    if (bindings?.mode) for (const anchor of document.querySelectorAll('[data-app-navigation-rail], [data-codex-composer-root], [data-chatgpt-composer], main, #root > *, #app > *')) {
      const scope=quickChatScope(codex,anchor);
      if (scope && bindings.mode(scope)==='codex') return scope;
    }
    return null;
  }
  async function load() {
    const findUrl = () => [...document.querySelectorAll('link[rel="modulepreload"],script[src]')].map(e => e.href || e.src).find(url => /\/app-initial-[^/]+\.js(?:$|\?)/.test(url));
    // 宿主可早于原生模块入口注入；等待入口挂载，不能把正常启动顺序当作协议失效。
    const url = findUrl() ?? await new Promise((resolve, reject) => {
      codex.report('quick-chat-shortcut', false, 'quick-chat-module-pending');
      const cleanup = () => { observer.disconnect(); signal.removeEventListener('abort', cancel); stopWaiting=null; };
      const cancel = () => { cleanup(); reject(new Error('quick-chat-load-aborted')); };
      const check = () => { const found=findUrl(); if (found) { cleanup(); resolve(found); } };
      const observer = new MutationObserver(check);
      stopWaiting=cancel;
      observer.observe(document.documentElement, {childList:true,subtree:true,attributes:true,attributeFilter:['href','src']});
      signal.addEventListener('abort', cancel, {once:true});
      if (disposed || signal.aborted) cancel(); else check();
    });
    const source = await (await fetch(url, {signal})).text();
    const module = await import(url);
    let native;
    try { native=quickChatNativeCommand(source); }
    catch (error) {
      if (error.message !== 'quick-chat-command-catalog-unavailable') throw error;
      // 新版命令目录移入共享模块；打开动作仍由入口模块导出。
      const file=source.match(/["'`]\.\/(app-shared-[\w-]+\.js)["'`]/)?.[1];
      if (!file) throw error;
      const response=await fetch(new URL(file,url).href,{signal});
      if (!response.ok) throw error;
      native=quickChatNativeCommand(await response.text());
    }
    const bindings={native};
    if (!native) {
      const roles = quickChatLifecycleExports(source);
      if (!module[roles.openState] && typeof module[roles.initialize] === 'function') module[roles.initialize]();
      const open = module[roles.open], create = module[roles.create], openState = module[roles.openState];
      if (typeof open !== 'function' || typeof create !== 'function' || !openState) throw new Error('quick-chat-open-action-unavailable');
      Object.assign(bindings,{open,create,isOpen:scope=>scope.get(openState)});
    }
    try {
      const actions=quickChatLifecycleActions(source);
      if (actions.mode && module[actions.mode]) bindings.mode=scope=>scope.get(module[actions.mode]);
      if (['close','draft','text'].every(key=>typeof module[actions[key]]==='function') && module[actions.session] && module[actions.attachments]) {
        bindings.close=(scope,id)=>{
          if (scope.get(module[actions.session])?.conversationId!==id) return false;
          module[actions.draft](scope,{draftKey:id,content:null});
          module[actions.text](scope,id,'');
          scope.set(module[actions.attachments],id,[]);
          module[actions.close](scope);
          return true;
        };
      }
    } catch { codex.report('quick-chat-close',false,'quick-chat-close-contract-unavailable'); }
    return bindings;
  }
  const ready = (discover ?? load)().then(value => {
    if (disposed || signal.aborted) return;
    bindings = value;
    codex.report('quick-chat-shortcut', true);
  }).catch(error => { if (!disposed && !signal.aborted) codex.report('quick-chat-shortcut', false,
    /^quick-chat-[\w-]+$/.test(error?.message) ? error.message : 'native-shortcut-contract-unavailable'); });
  function activate({minimize=false} = {}) {
    if (disposed || signal.aborted || !bindings || bindings.native) return false;
    const scope = context();
    if (scope && bindings.isOpen(scope) === false) {
      pendingFocus={scope,previous:new Set([...document.querySelectorAll('[data-floating-chat-surface]')].map(sessionId))};
      bindings.create(scope);
      focusNew();
    } else if (!activateExisting(minimize)) {
      if (!scope) return false;
      bindings.open(scope);
    }
    return true;
  }
  function close(surface,id) {
    const scope=quickChatScope(codex,surface);
    if (!scope || !bindings?.close || disposed || signal.aborted) return false;
    pendingFocus=null;
    return bindings.close(scope,id);
  }
  function keydown(event) {
    const primaryModifier = windows ? event.ctrlKey && !event.metaKey : event.metaKey && !event.ctrlKey;
    if (event.defaultPrevented || event.repeat || event.isComposing
      || !primaryModifier || !event.altKey || event.shiftKey || event.code !== 'KeyN' || !activate({minimize:true})) return;
    event.preventDefault();
    event.stopPropagation();
  }
  document.addEventListener('keydown', keydown, {signal});
  function dispose() { disposed = true; stopWaiting?.(); document.removeEventListener('keydown', keydown); bindings = null; pendingFocus=null; }
  signal.addEventListener('abort', dispose, {once:true});
  return {ready, dispose, sync:focusNew, activate, close, canClose:() => Boolean(bindings?.close && !disposed && !signal.aborted), available:() => Boolean(bindings && !bindings.native && !disposed && !signal.aborted)};
}
