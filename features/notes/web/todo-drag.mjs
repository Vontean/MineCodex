// Todo 拖拽排序纯算法：drop 位置判定与顺序重排。
// 不触碰 DOM/状态，仅输入计算；app.js 的拖拽事件处理调用它们。

function todoDropPosition(event, row) {
  const rect = row.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
}

function reorderedTodoIds(ids, draggedId, targetId, position) {
  if (!ids.includes(draggedId) || !ids.includes(targetId) || draggedId === targetId) return ids;
  const reordered = ids.filter((id) => id !== draggedId);
  const targetIndex = reordered.indexOf(targetId);
  const insertAt = targetIndex + (position === "after" ? 1 : 0);
  reordered.splice(insertAt, 0, draggedId);
  return reordered;
}

export { todoDropPosition, reorderedTodoIds };
