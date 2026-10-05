// 请求只到达发起 App 所在窗口，不经共享服务队列寻找任意聚焦窗口。
export function installPromptInsertion(signal, {codex, api, insertText}) {
  const navigation = codex.navigation();
  let remembered = null, busy = false;
  function remember(composer) {
    const location = navigation?.location();
    if (!location || location.path.startsWith('/mcp-app/') || !composer) return;
    remembered = {location, editable:composer.editable, threadId:composer.threadId,
      placement:composer.root.getAttribute('data-composer-placement')};
  }
  function available() {
    const target = remembered?.editable;
    return codex.composer(target ?? null, {purpose:'insertion'});
  }
  function waitForComposer(valid, original, deadline) {
    return new Promise((resolve,reject) => {
      let observer, timer;
      const finish = (error, value) => {observer?.disconnect();clearTimeout(timer);error ? reject(error) : resolve(value);};
      const check = () => {
        if (!valid()) return finish(new Error('Input changed before insertion'));
        const candidates = [...document.querySelectorAll('[contenteditable="true"]')]
          .map(editable => codex.composer(editable,{purpose:'insertion'}))
          .filter(composer => composer && composer.threadId === original.threadId
            && composer.root.getAttribute('data-composer-placement') === original.placement);
        if (candidates.length > 1) return finish(new Error('Input changed before insertion'));
        if (candidates.length === 1) finish(null,candidates[0]);
      };
      observer = new MutationObserver(check);
      observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','inert','aria-hidden']});
      timer = setTimeout(() => finish(new Error('No available input in the focused window')),Math.max(0,Math.min(2000,deadline-Date.now())));
      check();
    });
  }
  async function receive(event) {
    if (event.data?.type !== 'minecodex:insert-prompt' || typeof event.data.promptId !== 'string') return;
    const port = event.ports?.[0];
    const source = codex.mcpAppSource(event.source,{server:'minecodex',pluginId:'minecodex@minecodex-local',resourceUri:'ui://minecodex/prompts.html'});
    if (!source || !port) return;
    if (busy || !document.hasFocus()) {port.postMessage({error:'Input changed before insertion'});port.close();return;}
    busy = true;
    const deadline = Math.min(Date.now() + 4000, event.data.expiresAt ?? Infinity);
    let cancelled = false, navigating = false, restoring = false, expected = navigation?.location(), inserted = false;
    const target = available();
    const original = target ? {editable:target.editable,threadId:target.threadId,placement:target.root.getAttribute('data-composer-placement')} : remembered;
    const onBlur = () => {queueMicrotask(() => {if (!document.hasFocus()) cancelled = true;});};
    const onFocus = event => {
      const editable = event.target.closest?.('[contenteditable="true"]');
      if (editable && editable !== original?.editable) {
        const focused = codex.composer(editable,{purpose:'insertion'});
        if (!restoring || navigation.location().path !== remembered?.location.path
          || focused?.threadId !== original?.threadId
          || focused?.root.getAttribute('data-composer-placement') !== original?.placement) cancelled = true;
      }
    };
    window.addEventListener('blur',onBlur);
    document.addEventListener('focusin',onFocus);
    const unsubscribe = navigation?.subscribe(location => {
      if (navigating && location.path === remembered?.location.path) {expected = location;navigating = false;}
      else if (location.key !== expected?.key) cancelled = true;
    });
    const valid = () => !cancelled && !signal.aborted && Date.now() < deadline && document.hasFocus();
    try {
      const state = await api('/api/state');
      const prompt = state.prompts.find(item => item.id === event.data.promptId);
      if (!prompt) throw new Error('Prompt was not found');
      if (!valid() || !source.connected()) throw new Error('Input changed before insertion');
      let composer = target && codex.composer(target.editable,{purpose:'insertion'});
      if (target && !composer) throw new Error('Input changed before insertion');
      if (!composer) {
        if (!original || !remembered || !navigation) throw new Error('No available input in the focused window');
        navigating = restoring = true;
        let timer;
        try {await Promise.race([navigation.navigate(remembered.location.path),new Promise((_,reject) => {
          timer = setTimeout(() => {cancelled = true;reject(new Error('No available input in the focused window'));},2000);
        })]);} finally {clearTimeout(timer);}
        composer = await waitForComposer(valid,original,deadline);
      }
      if (!valid() || composer.threadId !== original?.threadId
        || composer.root.getAttribute('data-composer-placement') !== original?.placement
        || (!navigating && navigation && navigation.location().key !== expected?.key)) throw new Error('Input changed before insertion');
      // 校验与同步填入之间不再等待；成功后计数失败不报告为可重试的插入失败。
      insertText(prompt.body,composer.editable);
      inserted = true;
      port.postMessage({ok:true});
      try {await api(`/api/prompts/${encodeURIComponent(prompt.id)}/use`,{method:'POST',body:{action:'insert',success:true}});}
      catch (error) {console.warn('[Prompts] Usage could not be saved',error);}
    } catch (error) {if (!inserted) port.postMessage({error:error.message});}
    finally {unsubscribe?.();window.removeEventListener('blur',onBlur);document.removeEventListener('focusin',onFocus);port.close();busy=false;}
  }
  window.addEventListener('message',receive,{signal});
  return {remember};
}
