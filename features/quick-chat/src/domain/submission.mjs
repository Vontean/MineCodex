// 发送确认会写入同会话的新呈现记录；拒绝发送不会更新该记录。
export function createSubmissionTracker() {
  let pending = null;
  return {
    begin(snapshot) { pending = snapshot.canSubmit ? {sessionId:snapshot.sessionId, receiptId:snapshot.receiptId} : null; },
    accepted(snapshot) {
      if (!pending) return false;
      if (pending.sessionId !== snapshot.sessionId) { pending = null; return false; }
      if (!snapshot.hasConversation || !snapshot.receiptId || snapshot.receiptId === pending.receiptId) return false;
      pending = null;
      return snapshot.receiptPresentation !== "minimized";
    },
    clear() { pending = null; },
  };
}
