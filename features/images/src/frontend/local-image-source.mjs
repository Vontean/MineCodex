// 只编排来源与加载状态；图库、标签、菜单及详情由原生 Adapter 承载。
export function installLocalImageSource(config, signal, sources, native) {
  let mounted;
  let revision = 0;
  let pendingPrompt;
  const text = (en, zh) => (document.documentElement.lang || navigator.language).startsWith("zh") ? zh : en;

  function requestPrompt(image) {
    pendingPrompt = image.id;
    document.dispatchEvent(new CustomEvent("minecodex:image-prompt", {detail:{imageId:image.id}}));
  }

  function unmount() {
    revision++;
    if (!mounted) return;
    const record = mounted;
    mounted = null;
    record.observer?.disconnect();
    record.view?.dispose();
    record.nav?.dispose();
    record.entry.tabs.hidden = record.tabsHidden;
    record.entry.content.hidden = record.contentHidden;
    record.entry.search?.removeEventListener("input", record.onSearch, true);
    record.entry.search?.removeEventListener("keydown", record.onSearchKey, true);
    if (record.entry.search) record.entry.search.value = record.searchValue;
    record.navigation.remove();
    record.area.remove();
  }

  function error(record) {
    record.message.textContent = text("Could not load local images.", "本地图片加载失败。");
    record.retry.hidden = false;
  }

  async function fetchPage(record, reset = false) {
    if (record.fetching && !reset) return;
    const current = ++revision;
    record.fetching = true;
    record.retry.hidden = true;
    if (reset) {
      record.images = [];
      record.offset = 0;
      record.total = 0;
      record.view.render({images:[], loading:true});
    }
    try {
      const page = await config.requestHostAction("local-image-source", {
        operation:"list", offset:record.offset, query:record.query,
      });
      if (signal.aborted || mounted !== record || revision !== current || !record.active) return;
      record.images.push(...page.images);
      record.offset += page.images.length;
      record.total = page.total;
      record.view.render({images:record.images, loading:false});
      record.message.textContent = page.total ? "" : text("No local images found.", "没有找到本地图片。");
      record.sentinel.hidden = record.offset >= record.total;
    } catch {
      if (mounted === record && revision === current) {
        record.view.render({images:record.images, loading:false});
        error(record);
      }
    } finally {
      if (mounted === record && revision === current) record.fetching = false;
    }
  }

  function activate(record, key) {
    revision++;
    record.view?.clearSelection();
    record.active = key === "imagegen";
    record.entry.content.hidden = record.active || record.contentHidden;
    record.area.hidden = !record.active;
    if (record.entry.search) record.entry.search.value = record.active ? record.query : record.searchValue;
    record.nav.render(key);
    if (record.active) void fetchPage(record, true);
  }

  async function scan() {
    if (signal.aborted) return;
    const entry = sources.read();
    if (mounted && mounted.entry.tabs === entry?.tabs) {
      if (!mounted.active) mounted.nav?.render(entry.selectedKey);
      return;
    }
    unmount();
    if (!entry) return;
    const navigation = document.createElement("div");
    navigation.dataset.minecodexImageNavigation = "true";
    entry.tabs.parentElement.append(navigation);
    const area = document.createElement("section");
    area.className = entry.content.className;
    area.id = "minecodex-image-gen-content";
    area.hidden = true;
    const container = document.createElement("div");
    const message = document.createElement("p");
    message.className = "text-sm text-secondary";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "rounded-full bg-text/5 px-4 py-2 text-sm text-default";
    retry.textContent = text("Try again", "重试");
    retry.hidden = true;
    const sentinel = document.createElement("div");
    sentinel.style.height = "1px";
    sentinel.hidden = true;
    sentinel.setAttribute("aria-hidden", "true");
    area.append(container, message, retry, sentinel);
    entry.content.after(area);
    const record = {
      entry, navigation, area, message, retry, sentinel,
      tabsHidden:entry.tabs.hidden, contentHidden:entry.content.hidden,
      searchValue:entry.search?.value ?? "", images:[], offset:0, total:0,
      query:"", fetching:false, active:false,
    };
    mounted = record;
    try {
      const results = await Promise.allSettled([
        native.mountNavigation(navigation, entry.tabs, key => activate(record, key)),
        native.mount(container, entry.tabs, {
          onOpen:(image, open) => open(image), onPrompt:requestPrompt,
          onHidden:ids=>{
            const hidden=new Set(ids),removed=record.images.filter(image=>hidden.has(image.id)).length;
            record.images=record.images.filter(image=>!hidden.has(image.id));
            record.offset=Math.max(0,record.offset-removed);record.total=Math.max(0,record.total-removed);
            record.sentinel.hidden=record.offset>=record.total;
          },
          onRetry:error => {
            console.error("MineCodex native Images rendering",error);
            if (mounted !== record) return;
            unmount();
            config.codex.report("images.local-source", false, "Native image rendering failed");
          },
        }),
      ]);
      // 任一原生能力失败时也释放已建立的另一棵 root。
      if (results.some(result => result.status === "rejected")) {
        for (const result of results) if (result.status === "fulfilled") result.value.dispose();
        throw results.find(result => result.status === "rejected").reason;
      }
      const [nav, view] = results.map(result => result.value);
      if (signal.aborted || mounted !== record) {
        nav.dispose();
        view.dispose();
        return;
      }
      record.nav = nav;
      record.view = view;
      entry.tabs.hidden = true;
      nav.render(entry.selectedKey);
      retry.onclick = () => fetchPage(record, true);
      record.observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting) && record.active && !record.fetching && record.offset < record.total) {
          void fetchPage(record);
        }
      }, {rootMargin:"400px"});
      record.observer.observe(sentinel);
      record.onSearch = event => {
        if (!record.active) return;
        event.stopImmediatePropagation();
        record.query = entry.search.value.slice(0, 256);
        void fetchPage(record, true);
      };
      record.onSearchKey = event => {
        if (record.active && event.key === "Enter") {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      };
      entry.search?.addEventListener("input", record.onSearch, true);
      entry.search?.addEventListener("keydown", record.onSearchKey, true);
    } catch {
      if (mounted === record) {
        unmount();
        config.codex.report("images.local-source", false, "Native image capability unavailable");
      }
    }
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {scheduled = false; void scan();});
  });
  observer.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:["aria-selected"]});
  void scan();
  const cleanup = () => {observer.disconnect(); unmount(); pendingPrompt = null;};
  signal.addEventListener("abort", cleanup, {once:true});
  return {
    cleanup,
    readViewer:header => native.readViewer(header),
    pendingPrompt:() => pendingPrompt,
    consumePrompt:() => {pendingPrompt = null;},
  };
}
