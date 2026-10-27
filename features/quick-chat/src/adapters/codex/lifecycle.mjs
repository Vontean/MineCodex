// 从原生“丢弃 Quick Chat”动作中仅取关闭和草稿清理；不调用会话销毁，保留后台生成。
export function quickChatLifecycleActions(source) {
  const match = source.match(/let ([\w$]+)=([\w$]+)\.get\(([\w$]+)\);([\w$]+)\(\2\),\2\.set\(\3,null\),\1!=null&&\(([\w$]+)\(\2,\{draftKey:\1\.conversationId,content:null\}\),([\w$]+)\(\2,\1\.conversationId,[`"'][`"']\),\2\.set\(([\w$]+),\1\.conversationId,\[\]\)/);
  if (!match) throw new Error('quick-chat-close-contract-unavailable');
  const exports = source.slice(source.lastIndexOf('export{'));
  const exported = local => {
    const escaped = local.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const name = exports.match(new RegExp(`(?:\\{|,)${escaped} as ([\\w$]+)(?:,|\\})`))?.[1];
    if (!name) throw new Error('quick-chat-close-export-unavailable');
    return name;
  };
  const roles = {session:exported(match[3]),close:exported(match[4]),draft:exported(match[5]),text:exported(match[6]),attachments:exported(match[7])};
  const mode = source.match(/([\w$]+)=[\w$]+\([\w$]+,\(\{get:[\w$]+\}\)=>\{[\s\S]{0,700}?conversationDetailMode[\s\S]{0,700}?[`"']STEPS_PROSE[`"'][^{}]*\?[`"']work[`"']:[`"']codex[`"']/)?.[1];
  if (mode) roles.mode=exported(mode);
  return roles;
}

export function quickChatScope(codex, element) {
  for (let fiber=codex.currentFiber(element),depth=0;fiber && depth++<200;fiber=fiber.return) {
    const values=[];
    for (let hook=fiber.memoizedState,count=0;hook && count++<150;hook=hook.next) values.push(hook.memoizedState?.current);
    for (const row of fiber.updateQueue?.memoCache?.data ?? []) values.push(...row);
    const scope=values.find(value=>typeof value?.get==='function' && typeof value.set==='function' && value.scope?.__scopeBrand==='AppScope');
    if (scope) return scope;
  }
  return null;
}
