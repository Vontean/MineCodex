export function createDirectoryRefreshAdapter(codex, signal = new AbortController().signal) {
  const visible = element => element.isConnected && !element.closest('[hidden],[inert],[aria-hidden="true"]')
    && element.checkVisibility({ visibilityProperty: true }) && element.getClientRects().length > 0;

  function context(anchor) {
    let directory = null, client = null, expanded = [];
    codex.props(anchor, props => {
      if (Array.isArray(props.initialExpandedPaths) && 'files' in props && 'renderTree' in props)
        expanded = props.initialExpandedPaths;
      if (!directory && typeof props.root === 'string' && typeof props.hostId === 'string'
        && 'includeHidden' in props && 'renderTree' in props) directory = props;
      for (const value of [props.value, props.client, props.queryClient, props.value?.queryClient])
        if (!client && typeof value?.getQueryCache === 'function' && typeof value.setQueryData === 'function') client = value;
      return Boolean(directory && client);
    }, 360);
    return { directory, client, expanded };
  }

  function directoryQueries(client, directory, expanded) {
    const directories = new Set([null, ...expanded]);
    return client.getQueryCache().getAll().filter(query => {
      const key = query.queryKey;
      if (key?.[0] !== 'vscode' || key[1] !== 'workspace-directory-entries' || !query.isActive()
        || typeof query.options?.queryFn !== 'function') return false;
      let params;
      try { params = JSON.parse(key.at(-1)); } catch { return false; }
      return params?.hostId === directory.hostId && params.workspaceRoot === directory.root
        && params.includeHidden === directory.includeHidden && directories.has(params.directoryPath);
    });
  }

  return {
    scan() {
      const views = [], roots = new Set();
      // 搜索框在空目录时也存在，不能只依赖文件树节点。
      const anchors = [...document.querySelectorAll('file-tree-container'), ...document.querySelectorAll('[id="workspace-directory-tree-search"]')];
      for (const anchor of anchors) {
        if (!visible(anchor)) continue;
        const { directory, client, expanded } = context(anchor);
        if (!directory) continue;
        const key = JSON.stringify([directory.hostId, directory.environmentId, directory.root]);
        if (roots.has(key)) continue;
        roots.add(key);
        const available = Boolean(client && directory.environmentId == null);
        const current = () => {
          if (signal.aborted || document.visibilityState === 'hidden' || !visible(anchor)) return false;
          const next = context(anchor);
          return next.client === client && next.directory?.hostId === directory.hostId
            && next.directory?.root === directory.root && next.directory?.environmentId === directory.environmentId
            && next.directory?.includeHidden === directory.includeHidden;
        };
        views.push({
          key, anchor, available, current, boundary: anchor.closest('[data-app-shell-pane-content-viewport]'),
          // 每轮重新取得 active queries，已收起的分支不会继续请求。
          queries: available ? directoryQueries(client, directory, expanded).map(query => ({
            async refresh() {
              if (!current() || !query.isActive() || query.state.fetchStatus === 'fetching') return;
              const path = JSON.parse(query.queryKey.at(-1)).directoryPath;
              if (path !== null && !context(anchor).expanded.includes(path)) return;
              const before = query.state.data, updatedAt = query.state.dataUpdatedAt;
              // 失败不进入原生 query 的 error 状态，避免原生树用错误页替换已有列表。
              const data = await query.options.queryFn({ client, queryKey: query.queryKey, meta: query.options.meta, signal });
              if (!Array.isArray(data?.entries)) throw new Error('directory-refresh-response-unavailable');
              if (!current() || !query.isActive() || query.state.fetchStatus === 'fetching'
                || query.state.data !== before || query.state.dataUpdatedAt !== updatedAt) return;
              if (path !== null && !context(anchor).expanded.includes(path)) return;
              client.setQueryData(query.queryKey, data);
            },
          })) : [],
        });
      }
      return views;
    },
  };
}
