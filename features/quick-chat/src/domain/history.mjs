export function createHistoryTracker() {
  let origin = null;
  return {
    open(snapshot) { if (snapshot.historyVisible) origin = snapshot.sessionId; },
    selected(snapshot) {
      if (origin === null || origin === snapshot.sessionId) return false;
      origin = null;
      return snapshot.hasConversation;
    },
    clear() { origin = null; },
  };
}
