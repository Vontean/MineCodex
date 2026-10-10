import {quickChatHistoryVisible} from "./history.mjs";
export function createQuickChatAdapter(codex) {
  const receipts = new WeakMap(), subscriptions = new WeakMap(), emitters = new WeakMap();
  let nextSubscription = 1;
  let nextReceipt = 1;
  const surfaceSelector = '[data-floating-chat-surface]';

  function read(surface) {
    if (!surface?.isConnected || surface.closest('[hidden], [inert], [aria-hidden="true"]')) return null;
    const editable = surface.querySelector('[data-chatgpt-composer] [contenteditable="true"]');
    if (!editable) return null;
    const composer = codex.props(editable, props => typeof props.isWorkConversation === "boolean" && props.conversationId);
    const session = codex.props(surface, props => props.session?.conversationId)?.session;
    const floating = codex.props(surface, props => typeof props.onPresentationChange === "function" && typeof props.renderMenu === "function");
    // Work 的页面横条没有经典 Chat 的历史动作，不能接入此功能。
    if (!composer || composer.isWorkConversation || composer.annotationSubmitTarget || composer.isWidgetOverlay || !session || !floating) return null;
    const history = floating.renderMenu({})?.props?.items?.find(item => item.id === "history" && typeof item.onSelect === "function");
    if (!history) return null;
    const state = codex.props(editable, props => typeof props.submitDisabled === "boolean" && props.conversationId);
    const controller = codex.props(editable, props => props.composerController?.eventEmitter)?.composerController;
    const minimize = [...surface.querySelectorAll('button')].find(button => {
      const props = codex.props(button, props => props.standalone === true && typeof props.onMinimize === "function" && typeof props.isCompact === "boolean", 5);
      return Boolean(props && button.checkVisibility({visibilityProperty:true}) && !button.hasAttribute('data-mcx-quick-chat-history'));
    });
    let receipt = null;
    for (let fiber = codex.currentFiber(surface), depth = 0; fiber && depth < 80; depth++, fiber = fiber.return) {
      if (fiber.memoizedProps?.session?.conversationId !== session.conversationId) continue;
      for (let hook = fiber.memoizedState, count = 0; hook && count < 140; hook = hook.next, count++) {
        const value = hook.memoizedState;
        // 26.1007 的按会话订阅状态为 [value, store, atom]，value 不再重复存 conversationId。
        const record=Array.isArray(value) ? value[0] : value;
        if (record && typeof record === "object" && "owner" in record && typeof record.presentation === "string"
          && (record.conversationId == null || record.conversationId === session.conversationId)) receipt = record;
      }
      if (receipt) break;
    }
    // 发送确认回调写入新记录；拒绝发送不会写入。记录身份只映射为窗口内序号。
    if (receipt && !receipts.has(receipt)) receipts.set(receipt, nextReceipt++);
    const frame = surface.closest('[role="dialog"]');
    const background = frame && [...frame.children].find(node => codex.props(node, props => props.asChild === true && typeof props.unstyled === "boolean", 8));
    const project = [...surface.querySelectorAll('[data-composer-rail-item] button')].find(button =>
      codex.props(button, props => props.variant === "composer" && typeof props.onProjectChange === "function"));
    const projectRail = project?.closest('[data-composer-rail-item]') ?? null;
    const expanded = Boolean(floating.presentation === "expanded" || floating.forceExpanded);
    const emitter = controller?.eventEmitter;
    const subscribable = typeof emitter?.addListener === "function" && typeof emitter?.removeListener === "function";
    if (subscribable && !subscriptions.has(emitter)) subscriptions.set(emitter, nextSubscription++);
    const snapshot = {surface, editable, minimize, projectRail, background:!session.hasConversation && floating.forceExpanded ? background : null, sessionId:session.conversationId, hasConversation:session.hasConversation,
      canSubmit:Boolean(state && !state.submitDisabled && !state.submitLoading), receiptId:receipt ? receipts.get(receipt) : 0, receiptPresentation:receipt?.presentation ?? null, subscriptionId:subscribable ? subscriptions.get(emitter) : 0,
      expanded, showHistory:Boolean(minimize && !expanded), historyVisible:quickChatHistoryVisible(floating.renderTranscript?.()),
      expand:() => floating.onPresentationChange("expanded"),
      // 历史动作通过 forceExpanded 临时展开；不要覆盖最小化后的恢复形态。
      history:() => history.onSelect()};
    if (subscribable) emitters.set(snapshot, emitter);
    return snapshot;
  }
  function surfaces() { return [...document.querySelectorAll(surfaceSelector)].map(read).filter(Boolean); }
  function subscribe(snapshot, listener) {
    const emitter = emitters.get(snapshot);
    if (!emitter?.addListener || !emitter?.removeListener) return () => {};
    // 不改变原生 emit 的 handled 结果，也不接管发送。
    const submit = () => { listener(); return false; };
    emitter.addListener("submit", submit);
    return () => emitter.removeListener("submit", submit);
  }
  return {surfaces, read, subscribe};
}
