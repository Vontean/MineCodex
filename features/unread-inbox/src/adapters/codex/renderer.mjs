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

// 会话侧栏是可卸载视图，通知从同一原生 store 读取完整目录。
export function createNotificationAdapter(codex, load, invalidate) {
  let bindings=null, loading=null, retryAt=0, disposed=false;
  function scopeFor(rail) {
    let fiber=codex.currentFiber(rail);
    for (let depth=0;fiber&&depth<160;depth++,fiber=fiber.return) {
      for (const values of fiber.updateQueue?.memoCache?.data ?? []) {
        const scope=values.find(value=>typeof value?.get==="function" && value.node?.store && value.query && value.scope);
        if (scope) return scope;
      }
    }
    return null;
  }
  function ensure() {
    if (bindings || loading || Date.now()<retryAt || disposed) return;
    loading=load().then(value=>{if(!disposed){bindings=value;invalidate();}}).catch(()=>{
      retryAt=Date.now()+30000;
      codex.report("task-notification-catalog",false,"native-module-contract-unavailable");
    }).finally(()=>{loading=null;});
  }
  function layout() {
    const rail=codex.rail();
    if (!rail) return {available:false};
    // 桌面端使用内存路由，window.location 不随页面跳转变化。
    let pageKey=null;
    codex.props(rail,props=>{
      pageKey=props.routeContext?.outlet?.props?.match?.pathname??null;
      return pageKey!==null;
    });
    const home=rail.querySelector('[data-sidebar-destination="builtin:home"]');
    const sidebar=document.querySelector('[data-slate-sidebar-content]:not([inert])');
    const isVisible=e=>!!e && !e.closest('[inert],[aria-hidden="true"]') && e.checkVisibility() && e.getBoundingClientRect().width>0;
    const homeSidebar=isVisible(sidebar) && isVisible(sidebar.querySelector('[data-app-action-sidebar-scroll]'));
    const peeking=home?.getAttribute("aria-expanded")==="true" || !!document.querySelector('[data-slate-sidebar-peeking="true"]');
    const titlebar=[...document.querySelectorAll('[data-app-shell-titlebar-slot="main"]')].find(isVisible);
    const rect=rail.getBoundingClientRect(), titleRect=titlebar?.getBoundingClientRect();
    return { available:true, pageKey, visible:!homeSidebar&&!peeking,
      left:rect.right+8, top:Math.max(rect.top,titleRect?.bottom??0)+8 };
  }
  function snapshot() {
    ensure();
    const rail=codex.rail(), scope=rail && scopeFor(rail);
    if (!bindings || !scope) {
      if (!scope) codex.report("task-notification-catalog",false,"native-scope-unavailable");
      return null;
    }
    try {
      const catalog=scope.get(bindings.catalog);
      const projectCatalog=scope.get(bindings.projects,"codex");
      const projects=new Map();
      for(const group of projectCatalog.projectGroups) for(const key of group.threadKeys) projects.set(key,{id:group.projectId,name:group.label});
      const rows=new Map([...document.querySelectorAll('[data-app-action-sidebar-thread-row]')].map(row=>[row.dataset.appActionSidebarThreadId,row]));
      const rowAdapter=createThreadAdapter(codex);
      const records=catalog.allSidebarThreadKeys.flatMap(key=>{
        const item=scope.get(bindings.thread,key), summary=item?.summary;
        // 目录中的待创建占位还没有可导航的正式会话。
        if (!summary?.conversationId || !summary.hostId) return [];
        const {conversationId,hostId}=summary, args={conversationId,hostId};
        const attention=scope.get(bindings.attention,args);
        const status=scope.get(bindings.status,args);
        const pending=scope.get(bindings.pending,{hostId,threadId:conversationId})?.pendingRequest;
        const resolution=scope.get(bindings.resolution,args);
        const countdown=attention==="response" && pending?.kind==="userInput" && resolution?.requestId===pending.userInputRequestId && resolution?.resolutionState?.status==="scheduled"
          ? {deadlineMs:resolution.resolutionState.deadlineMs,durationMs:bindings.countdownDuration} : null;
        const unread=scope.get(bindings.unread,{conversationId,fallbackRootUnread:summary.hasUnreadTurn});
        const row=rows.get(key), mounted=row ? rowAdapter.read(row) : null;
        return [{key,threadId:conversationId,hostId,title:summary.title||mounted?.title||"",
          summary:mounted?.summary||"",project:projects.get(key)??mounted?.project??null,
          timestamp:unread.unreadMessageAt??summary.recencyAt??summary.updatedAt??null,
          unread:unread.hasUnread,working:status==="loading"&&attention!=="response",
          attention:attention==="approval"?"approval":attention==="response"?"input":null,
          countdown,spinner:mounted?.spinner||"",activate:()=>bindings.navigate(scope,conversationId,hostId==="local"?undefined:hostId)}];
      });
      let auth=null;
      codex.props(rail,props=>{
        auth=[props.auth,props.value].find(value=>value && typeof value==="object" && "authMethod" in value && "accountId" in value && "userId" in value)??null;
        return Boolean(auth);
      });
      if(auth?.isLoading)return null;
      const currentId=codex.composerSurface?.()?.threadId??codex.currentThreadId();
      codex.report("task-notification-catalog",true);
      return {records,currentKey:records.find(item=>item.threadId===currentId)?.key??null,account:auth ? `${auth.authMethod}:${auth.accountId}:${auth.userId}` : scope.node};
    } catch {
      codex.report("task-notification-catalog",false,"native-store-contract-unavailable");
      return null;
    }
  }
  return {snapshot,layout,dispose(){disposed=true;bindings=null;}};
}
