// 状态变化产生新通知；流式摘要刷新只更新内容，不抢占顶部。
export function createNotificationQueue() {
  const entries = new Map();
  let sequence = 0;
  function update(records, currentKey) {
    const present = new Set();
    for (const item of records) {
      if (!item.key) continue;
      present.add(item.key);
      const state = item.attention || (item.unread && item.working === false ? "unread" : null);
      if (!state || item.key === currentKey) { entries.delete(item.key); continue; }
      const previous = entries.get(item.key);
      const event = `${state}:${state === "unread" ? item.timestamp ?? "" : ""}`;
      const changed = previous?.event !== event;
      entries.set(item.key, { item, event, order:changed ? ++sequence : previous.order, dismissed:changed ? false : previous.dismissed });
    }
    for (const key of entries.keys()) if (!present.has(key)) entries.delete(key);
    return [...entries.values()].filter(entry => !entry.dismissed).sort((a,b) => b.order-a.order).map(entry => entry.item);
  }
  return { update, dismiss(key) { const entry=entries.get(key); if (entry) entry.dismissed=true; }, clear() { entries.clear(); } };
}
