// 统一解释原生历史列表；原始 React 节点不越过 Adapter 边界。
export function quickChatHistoryVisible(node) {
  if (Array.isArray(node)) return node.some(quickChatHistoryVisible);
  const props = node?.props;
  if (!props || props.hidden || props.inert || props['aria-hidden']) return false;
  if (Array.isArray(props.conversations) && typeof props.onConversationSelect === 'function' && typeof props.onNewChat === 'function') return true;
  return quickChatHistoryVisible(props.children);
}
