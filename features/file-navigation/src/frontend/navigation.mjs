import { fileNavigationPath, selectFileNavigationDirectory } from '../domain/navigation.mjs';

export function installFileNavigation(view, ui, locale) {
  const copy = locale === 'zh-CN'
    ? { browse: '浏览并切换文件', loading: '正在加载…', empty: '此文件夹为空', error: '无法读取文件夹，点击重试' }
    : { browse: 'Browse and switch files', loading: 'Loading…', empty: 'This folder is empty', error: 'Could not load folder. Click to retry.' };
  const unbind = ui.theme.bindScope(view.capsule, ['--font-sans-default', '--text-sm', '--font-weight-medium', '--color-text-primary', '--color-text-secondary', '--color-ring', '--spacing', '--radius-full']);
  const life = new AbortController();
  const path = fileNavigationPath(view.rootName, view.path);
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'mcx-file-navigation-trigger cursor-interaction';
  trigger.setAttribute('aria-label', copy.browse); trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.dataset.parts = path.labels.length;
  trigger.setAttribute('data-minecodex-tooltip', [view.rootName, view.path].join('/'));
  path.labels.forEach((label, index) => {
    if (index && view.separator) {
      const separator = view.separator.cloneNode(true); separator.classList.add('mcx-file-navigation-separator');
      trigger.append(separator);
    }
    const span = document.createElement('span'); span.textContent = label;
    span.className = index === path.labels.length - 1 ? 'mcx-file-navigation-name' : 'mcx-file-navigation-parent';
    trigger.append(span);
  });
  view.nav.setAttribute('data-mcx-file-navigation-original', '');
  view.capsule.append(trigger);
  let popover = null, session = null, columns = [], directories = [], native = null;
  let disposed = false, suppressEscapeRelease = false;
  function close(focus = false) {
    session?.abort(); session = null;
    for (const column of columns) column.mount?.dispose();
    columns = []; popover?.remove(); popover = null;
    trigger.setAttribute('aria-expanded', 'false');
    if (focus && trigger.isConnected) {
      trigger.focus();
      // 文件树卸载也会恢复焦点；等该轮清理结束，再交还当前路径入口。
      requestAnimationFrame(() => { if (!disposed && !session && trigger.isConnected) trigger.focus(); });
    }
  }
  function position() {
    trigger.toggleAttribute('data-compact', view.capsule.parentElement.getBoundingClientRect().width < 330);
    if (!popover) return;
    const anchor = view.capsule.getBoundingClientRect(), bounds = view.boundary.getBoundingClientRect();
    const zoom = Number.parseFloat(getComputedStyle(document.body).zoom) || 1;
    const leftEdge = Math.max(8, bounds.left + 8), rightEdge = Math.min(innerWidth - 8, bounds.right - 8);
    const width = Math.max(0, Math.min(744, rightEdge - leftEdge));
    const below = Math.min(innerHeight, bounds.bottom) - anchor.bottom - 24;
    const above = anchor.top - Math.max(0, bounds.top) - 24;
    const down = below >= 180 || below >= above;
    const height = Math.max(60, Math.min(320, down ? below : above));
    popover.style.width = `${width / zoom}px`; popover.style.height = `${height / zoom}px`;
    popover.style.left = `${Math.max(leftEdge, Math.min(anchor.left, rightEdge - width)) / zoom}px`;
    popover.dataset.side = down ? 'bottom' : 'top';
    popover.style.top = `${(down ? anchor.bottom : anchor.top - height) / zoom}px`;
  }
  async function loadColumn(directory, index, current) {
    const element = document.createElement('div'); element.className = 'mcx-file-navigation-column';
    element.setAttribute('aria-label', directory || view.rootName);
    const column = { element, directory, mount: null, alive: true };
    columns.push(column); popover.append(element);
    const message = document.createElement('div'); message.className = 'mcx-file-navigation-message';
    message.setAttribute('role', 'status'); message.textContent = copy.loading; element.append(message);
    const valid = () => !current.aborted && column.alive;
    async function load() {
      try {
        const entries = await view.list(directory, current);
        if (!valid()) return;
        element.replaceChildren();
        if (!entries.length) { message.textContent = copy.empty; element.append(message); return; }
        column.mount = native.mountColumn(element, entries, directories[index + 1] ?? view.path, entry => {
          if (!valid()) return;
          if (!entry.directory) { close(); view.open(entry); return; }
          for (const old of columns.splice(index + 1)) { old.alive = false; old.mount?.dispose(); old.element.remove(); }
          directories = selectFileNavigationDirectory(directories, index, entry.path);
          loadColumn(entry.path, index + 1, current);
          requestAnimationFrame(() => { if (popover) popover.scrollLeft = popover.scrollWidth; });
        }, () => {
          const previous = columns[index - 1];
          if (previous) { previous.element.scrollIntoView({ block: 'nearest', inline: 'nearest' }); previous.mount?.focus(); }
          else trigger.focus();
        });
      } catch {
        if (!valid()) return;
        const retry = document.createElement('button'); retry.type = 'button';
        retry.className = 'mcx-file-navigation-message cursor-interaction'; retry.textContent = copy.error;
        retry.onclick = () => { element.replaceChildren(message); message.textContent = copy.loading; load(); };
        element.replaceChildren(retry);
      }
    }
    await load();
  }
  async function open() {
    if (session) { close(true); return; }
    session = new AbortController(); const current = session.signal;
    try {
      native = await view.prepare();
      if (current.aborted || disposed) return;
      popover = document.createElement('div'); popover.className = 'mcx-file-navigation-popover';
      popover.setAttribute('role', 'dialog'); popover.setAttribute('aria-label', copy.browse);
      ui.surface(popover, 'popover'); ui.mount(popover, 'floating');
      trigger.setAttribute('aria-expanded', 'true');
      directories = path.directories.slice(); position();
      await Promise.all(directories.map((directory, index) => loadColumn(directory, index, current)));
      if (!current.aborted && popover) {
        popover.scrollLeft = popover.scrollWidth;
        requestAnimationFrame(() => { if (!current.aborted) columns.at(-1)?.mount?.focus(); });
      }
    } catch {
      if (current.aborted) return;
      close();
      // 原生能力失效时立即交还已有导航，不能留一个无响应的替身入口。
      dispose();
    }
  }
  trigger.addEventListener('click', open, { signal: life.signal });
  document.addEventListener('pointerdown', event => {
    if (session && !event.composedPath().includes(trigger) && !event.composedPath().includes(popover)) close();
  }, { capture: true, signal: life.signal });
  window.addEventListener('keydown', event => {
    if (!popover) return;
    if (event.key === 'Escape') { suppressEscapeRelease = true; event.preventDefault(); event.stopImmediatePropagation(); close(true); }
    if (event.key === 'Tab') close();
  }, { capture: true, signal: life.signal });
  // 原生全局 Escape 在释放阶段也处理焦点；同一次关闭需消费完整按键周期。
  window.addEventListener('keyup', event => {
    if (event.key !== 'Escape' || !suppressEscapeRelease) return;
    suppressEscapeRelease = false;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!disposed && trigger.isConnected) trigger.focus();
  }, { capture: true, signal: life.signal });
  window.addEventListener('resize', position, { signal: life.signal });
  window.addEventListener('blur', () => close(), { signal: life.signal });
  const resize = new ResizeObserver(position); resize.observe(view.capsule); resize.observe(view.boundary); resize.observe(view.capsule.parentElement);
  function dispose() {
    if (disposed) return;
    disposed = true; close(); life.abort(); resize.disconnect(); trigger.remove();
    view.nav.removeAttribute('data-mcx-file-navigation-original'); unbind();
  }
  return { dispose, available: () => !disposed && trigger.isConnected };
}
