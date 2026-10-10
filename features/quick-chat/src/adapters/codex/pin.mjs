export function createQuickChatPinAdapter(codex) {
  const layerSelector = '.fixed.inset-0.zoom-adjusted-viewport.pointer-events-auto';
  function historyVisible(node) {
    if (Array.isArray(node)) return node.some(historyVisible);
    const props = node?.props;
    if (!props || props.hidden || props.inert || props['aria-hidden']) return false;
    if (Array.isArray(props.conversations) && typeof props.onConversationSelect === 'function' && typeof props.onNewChat === 'function') return true;
    return historyVisible(props.children);
  }
  function surfaces() {
    const inCodex = [...document.querySelectorAll('button[aria-haspopup="menu"]')].some(button => button.checkVisibility({visibilityProperty:true})
      && codex.props(button, p => typeof p.onModeSelect === 'function' && typeof p.mode === 'string', 80)?.mode === 'codex');
    if (!inCodex) return [];
    return [...document.querySelectorAll('[data-floating-chat-surface]')].flatMap(surface => {
      const layer = surface.closest(layerSelector);
      if (!layer || layer.closest('[hidden], [inert], [aria-hidden="true"]')) return [];
      if (!codex.props(surface, p => p.name === 'QuickChatWindow', 120)) return [];
      const presence = codex.props(surface, p => typeof p.isPresent === 'boolean' && typeof p.onExitComplete === 'function', 120);
      if (presence?.isPresent === false) return [];
      const editable = surface.querySelector('[data-chatgpt-composer] [contenteditable="true"]');
      const composer = editable && codex.props(editable, p => typeof p.isWorkConversation === 'boolean' && p.conversationId);
      const session = codex.props(surface, p => p.session?.conversationId)?.session;
      const floating = codex.props(surface, p => typeof p.onMinimizedChange === 'function' && typeof p.renderMenu === 'function');
      if (!composer || composer.isWorkConversation || composer.annotationSubmitTarget || composer.isWidgetOverlay || !session?.hasConversation || !floating) return [];
      const anchor = surface.querySelector('header button[data-quick-chat-drag-handle]');
      const expanded = floating.presentation === 'expanded' || floating.forceExpanded;
      const history = historyVisible(floating.renderTranscript?.());
      return [{surface, layer, sessionId:session.conversationId, anchor, minimized:Boolean(floating.isMinimized), expanded:Boolean(expanded), history,
        expand:() => floating.onPresentationChange('expanded'),
        showPin:Boolean(anchor && expanded && !floating.isMinimized && !history)}];
    });
  }
  return {surfaces};
}
