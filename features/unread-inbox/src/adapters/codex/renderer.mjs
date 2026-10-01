export function createThreadAdapter(codex) {
function isUnread(row) {
  let fiber = codex.currentFiber(row);
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    if (typeof fiber.memoizedProps?.isUnread === "boolean") return fiber.memoizedProps.isUnread;
  }
  return null;
}
function isWorking(row) {
  let fiber = codex.currentFiber(row);
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    const status = fiber.memoizedProps?.statusState;
    if (status?.type) return status.type === "loading";
  }
  return null;
}
function projectForRow(row) {
  let fiber = codex.currentFiber(row);
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    const group = fiber.memoizedProps?.secondaryContent?.props?.projectGroup;
    if (group?.projectId) return { id:group.projectId, name:group.label };
  }
  return null;
}
function attentionState(row) {
  let fiber = codex.currentFiber(row);
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    // 复用原生状态契约，不从摘要文案推断待确认状态。
    if (props?.chips?.some(chip => chip.id === "awaiting-approval")) return "approval";
    if (props?.statusPill?.label?.props?.id === "codex.localTaskRow.needsInput") return "input";
  }
  return null;
}
function threadDetails(row) {
  let fiber = codex.currentFiber(row);
  let summary, hostConfig;
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    summary ||= fiber.memoizedProps?.threadSummary;
    hostConfig ||= fiber.memoizedProps?.hoverCardHostConfig;
  }
  const hostId = summary?.hostId || row.dataset.appActionSidebarThreadHostId || "local";
  const nativeTime = summary?.recencyAt ?? summary?.updatedAt ?? null;
  return {
    title:row.dataset.appActionSidebarThreadTitle || row.querySelector("[data-thread-title]")?.textContent || "",
    summary:row.querySelector("[data-thread-secondary-title]")?.textContent || "",
    // 与原生 Thread hover card 相同，优先使用任务 recency 时间。
    timestamp:nativeTime,
    hostId, hostName:hostConfig?.display_name || hostId,
    project:projectForRow(row),
    working:isWorking(row),
    attention:attentionState(row),
  };
}
function threadRecord(row) {
  codex.report("thread-status",Boolean(codex.currentFiber(row)),codex.currentFiber(row) ? null : "thread-props-unavailable");
  let fiber = codex.currentFiber(row);
  let activate = null;
  for (let depth = 0; fiber && depth < 35; depth++, fiber = fiber.return) {
    const props = fiber.memoizedProps;
    if (props?.statusState && typeof props.onClick === "function") { activate = props.onClick; break; }
  }
  return { ...threadDetails(row), key:row.dataset.appActionSidebarThreadId, unread:isUnread(row), activate, spinner:row.querySelector?.('[class~="motion-safe:animate-spin"]')?.outerHTML ?? "" };
}
  return {read:threadRecord};
}
