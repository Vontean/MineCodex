// 从已注册的原生模块与导出表解析角色，不执行模块工厂或依赖压缩名称。
export async function loadRspackQuickChatBindings(registry, commandCatalog) {
  const catalog=registry.module(source=>/\{id:[`"']temporaryChat[`"'],titleIntlId:/.test(source),'Quick Chat command catalog');
  const native=commandCatalog(catalog.source);
  if (native) return {native};
  const entry=registry.module(source=>/has-opened-quick-chat-v1/.test(source)&&/chatgpt\.quick-chat/.test(source),'Quick Chat lifecycle');
  await registry.initialize(entry);
  const exported=local=>{
    if (!local) throw new Error('quick-chat-lifecycle-contract-unavailable');
    const escaped=local.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const key=entry.source.match(new RegExp(`([\\w$]+):\\(\\)=>${escaped}(?=[,}])`))?.[1];
    const value=key && registry.exports(entry)[key];
    if (value==null) throw new Error('quick-chat-lifecycle-export-unavailable');
    return value;
  };
  const open=registry.value(entry,(value,source)=>typeof value==='function'&&/chatgpt\.quick-chat/.test(source)&&/\.get\(([\w$]+)\)\|\|/.test(source),'Quick Chat open');
  const source=String(open);
  const create=exported(source.match(/null==[\w$]+\?([\w$]+)\([\w$]+,[\w$]+\):/)?.[1]);
  const state=exported(source.match(/\.get\(([\w$]+)\)\|\|/)?.[1]);
  const bindings={native,open,create,isOpen:scope=>scope.get(state)};
  if (typeof create!=='function') throw new Error('quick-chat-lifecycle-contract-unavailable');
  try {
    const discard=registry.value(entry,(value,source)=>typeof value==='function'&&/draftKey:/.test(source)&&/content:null/.test(source)&&/conversationId,""/.test(source),'Quick Chat discard');
    const actions=String(discard).match(/let ([\w$]+)=([\w$]+)\.get\(([\w$]+)\);([\w$]+)\(\2\),\2\.set\(\3,null\),null!=\1&&\(\(0,([\w$]+\.[\w$]+)\)\(\2,\{draftKey:\1\.conversationId,content:null\}\),\(0,([\w$]+\.[\w$]+)\)\(\2,\1\.conversationId,""\),\2\.set\(([\w$]+\.[\w$]+),\1\.conversationId,\[\]\)/);
    if (!actions) throw new Error('quick-chat-close-contract-unavailable');
    const session=exported(actions[3]),close=exported(actions[4]);
    const draft=registry.binding(entry,actions[5]),text=registry.binding(entry,actions[6]),attachments=registry.binding(entry,actions[7]);
    if ([close,draft,text].some(value=>typeof value!=='function')) throw new Error('quick-chat-close-contract-unavailable');
    bindings.close=(scope,id)=>{
      if (scope.get(session)?.conversationId!==id) return false;
      draft(scope,{draftKey:id,content:null});text(scope,id,'');scope.set(attachments,id,[]);close(scope);return true;
    };
  } catch { /* 关闭协议独立失效时仍保留打开能力。 */ }
  try {
    const modeEntry=registry.module(source=>/conversationDetailMode/.test(source)&&/"work":"codex"/.test(source),'Quick Chat product mode');
    const modes=Object.values(registry.exports(modeEntry));
    if (modes.length===1) bindings.mode=scope=>scope.get(modes[0]);
  } catch { /* 无模式 selector 时只使用可见模式选择器。 */ }
  return bindings;
}

export async function loadRspackQuickChatIcon(registry) {
  let entry;
  try {
    entry=registry.module(source=>/"data-floating-chat-surface":/.test(source)&&/minimizedIcon:/.test(source),'Quick Chat floating surface');
  } catch (error) {
    if (!/contract changed/.test(error?.message ?? '')) throw error;
    // The floating surface is behind the native QuickChatWindow lazy import.
    // Load the declared parent component first; its Promise.all list owns the
    // floating-surface chunk and remains valid when chunk IDs change.
    const loader=registry.module(source=>/QuickChatWindow/.test(source)&&/Promise\.all\(\[/.test(source)&&/\.then\([^)]*\.bind\([^,]+,"[^"\n]+"\)\)\)\.QuickChatWindow/.test(source),'Quick Chat floating surface loader');
    // The parent lazy component has a broad dependency graph. Loading its
    // declared chunks is sufficient to register the floating surface; running
    // the parent factory here can race another async Rspack dependency.
    await registry.lazy(loader,'QuickChatWindow',{initialize:false});
    entry=registry.module(source=>/"data-floating-chat-surface":/.test(source)&&/minimizedIcon:/.test(source),'Quick Chat floating surface');
  }
  await registry.initialize(entry);
  const local=entry.source.match(/minimizedIcon:([\w$]+)/)?.[1];
  const escaped=local?.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const reference=escaped&&entry.source.match(new RegExp(`children:${escaped}\\?\\?\\(0,[\\w$]+\\.jsx\\)\\(([\\w$]+\\.[\\w$]+),\\{\\}\\)`))?.[1];
  if (!reference) throw new Error('quick-chat-icon-contract-unavailable');
  const icon=registry.binding(entry,reference);
  if (typeof icon?.createElement!=='function') throw new Error('quick-chat-icon-contract-unavailable');
  return icon;
}
