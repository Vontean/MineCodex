import {previewContent} from './preview-content.js';

export function installFeaturePreviews(grid, locale) {
  let zh = locale === 'zh-CN';
  const t = (cn, en) => zh ? cn : en;
  const lifetime = new AbortController();
  const on = (node, type, fn, options = {}) => node.addEventListener(type, fn, {...options, signal: lifetime.signal});
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = null, panel = null, video = null, enterTimer, leaveTimer, replayTimer, pinned = false, generation = 0, restoring = false, mediaAbort = null;
  let manifest, hoveredCard = null, hoveredPanel = false, pendingCard = null;
  const media = () => manifest ??= window.minecodexPreviewMedia !== undefined
    ? Promise.resolve(window.minecodexPreviewMedia)
    : fetch('/assets/previews/manifest.json').then(r => r.ok ? r.json() : {}).then(value => value && typeof value === 'object' ? value : {}).catch(() => ({}));
  const node = (tag, cls, text) => {
    const el = document.createElement(tag); el.className = cls; if (text) el.textContent = text; return el;
  };
  async function resourceUrl(id, kind, value, signal) {
    if (!window.minecodexMcpApp) return `/assets/previews/${value}`;
    const response = await window.minecodexMcpApp.readServerResource({uri:`resource://minecodex/previews/${id}/${kind}`}, {signal});
    const resource = response.contents?.[0];
    if (!resource?.blob) throw new Error('Preview resource unavailable');
    return `data:${resource.mimeType};base64,${resource.blob}`;
  }
  function close({restore = false} = {}) {
    clearTimeout(enterTimer); clearTimeout(leaveTimer); clearTimeout(replayTimer); generation++;
    mediaAbort?.abort(); mediaAbort = null;
    // 先释放状态再移除节点，避免焦点退出事件重入清理。
    const closingPanel = panel, card = current, player = video;
    panel = null; current = null; video = null; pinned = false;
    if (player) { player.pause(); player.removeAttribute('src'); player.load(); }
    const trigger = card?.querySelector('.preview-entry');
    trigger?.setAttribute('aria-expanded', 'false');
    trigger?.removeAttribute('aria-controls');
    card?.classList.remove('is-previewing');
    grid.classList.remove('has-preview');
    closingPanel?.remove();
    if (restore && trigger?.isConnected) { restoring = true; trigger.focus({preventScroll: true}); restoring = false; }
  }
  function position() {
    if (!current || !panel) return;
    const rect = current.getBoundingClientRect();
    const width = Math.min(360, innerWidth - 32);
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${Math.max(120, innerHeight - 32)}px`;
    const height = panel.getBoundingClientRect().height;
    let left, top;
    if (innerWidth - rect.right >= width + 24) left = rect.right + 8;
    else if (rect.left >= width + 24) left = rect.left - width - 8;
    else {
      left = Math.max(16, Math.min(rect.left, innerWidth - width - 16));
      // 窄屏把面板放到开关下方，避免挡住当前操作。
      const below = innerHeight - rect.bottom - 24, above = rect.top - 24;
      if (below >= Math.min(height, 180)) {
        panel.style.maxHeight = `${below}px`; top = rect.bottom + 8;
      } else if (above >= Math.min(height, 180)) {
        panel.style.maxHeight = `${above}px`; top = Math.max(16, rect.top - height - 8);
      } else {
        top = Math.max(16, rect.top + current.querySelector('.plugin-topline').getBoundingClientRect().height + 32);
        panel.style.maxHeight = `${Math.max(100, innerHeight - top - 16)}px`;
      }
    }
    top ??= Math.max(16, Math.min(rect.top, innerHeight - height - 16));
    Object.assign(panel.style, {left: `${left}px`, top: `${top}px`, visibility: 'visible'});
  }
  function scheduleClose() {
    if (!pinned && !hoveredCard && !hoveredPanel) leaveTimer = setTimeout(() => close(), 100);
  }
  async function addMedia(id, host, state, ticket) {
    const resources = (await media())?.[id];
    if (ticket !== generation || !panel || !resources) return;
    mediaAbort = new AbortController();
    const mediaSignal = mediaAbort.signal;
    let posterUrl, videoUrl, resourceFailed = false;
    state.textContent = t('正在加载预览…', 'Loading preview…');
    const urls = await Promise.all(['poster', 'video'].map(async kind => {
      if (!resources[kind]) return null;
      try { return await resourceUrl(id, kind, resources[kind], mediaSignal); }
      catch { resourceFailed = true; return null; }
    }));
    if (ticket !== generation) return;
    [posterUrl, videoUrl] = urls;
    state.textContent = resourceFailed ? t('资源暂不可用 · 请参考说明', 'Preview unavailable · See description') : t('演示视频准备中', 'Demo video coming soon');
    let poster = null;
    if (posterUrl) {
      poster = node('img', 'preview-poster'); poster.alt = t('功能静态预览', 'Static feature preview');
      poster.addEventListener('load', position, {once: true});
      poster.addEventListener('error', () => { poster.remove(); resourceFailed = true; if (!video) state.textContent = t('资源暂不可用 · 请参考说明', 'Preview unavailable · See description'); position(); }, {once: true});
      poster.src = posterUrl; host.append(poster);
      state.textContent = t('静态预览', 'Static preview');
    }
    if (!videoUrl) { position(); return; }
    if (reduced.matches) { position(); return; }
    const player = node('video', 'preview-video'); video = player;
    player.muted = true; player.playsInline = true; player.preload = 'metadata'; player.hidden = true;
    const fallback = () => {
      panel.classList.remove('is-media-only');
      if (poster) poster.hidden = false;
    };
    const failed = () => {
      if (ticket !== generation) return;
      clearTimeout(replayTimer); player.pause(); player.removeAttribute('src'); player.load(); player.remove(); video = null; fallback();
      state.textContent = poster?.isConnected ? t('视频暂不可用 · 静态预览', 'Video unavailable · Static preview') : t('视频暂不可用 · 请参考说明', 'Video unavailable · See description'); position();
    };
    player.addEventListener('error', failed, {once: true});
    player.addEventListener('loadeddata', () => {
      if (ticket !== generation) return;
      position();
    });
    player.addEventListener('play', () => {
      if (ticket !== generation) return;
      player.hidden = false; if (poster) poster.hidden = true;
      panel.classList.add('is-media-only'); position();
    });
    const playVideo = async () => {
      if (ticket !== generation) return;
      try { await player.play(); }
      catch {
        if (ticket === generation && video === player && player.isConnected) {
          player.hidden = true; fallback();
          state.textContent = poster?.isConnected ? t('静态预览', 'Static preview') : t('演示视频准备中', 'Demo video coming soon'); position();
        }
      }
    };
    player.addEventListener('ended', () => {
      clearTimeout(replayTimer);
      replayTimer = setTimeout(() => {
        if (ticket !== generation || video !== player) return;
        player.currentTime = 0; void playVideo();
      }, 2000);
    });
    host.append(player); state.textContent = t('正在加载演示…', 'Loading demo…');
    player.src = videoUrl;
    void playVideo();
    position();
  }
  function open(card, fixed = false) {
    clearTimeout(enterTimer); clearTimeout(leaveTimer);
    if (card === current) { pinned ||= fixed; return; }
    close(); hoveredPanel = false; current = card; pinned = fixed;
    panel = node('section', 'feature-preview'); panel.id = 'feature-preview'; panel.setAttribute('role', 'region');
    const title = node('h3', 'preview-title', card.querySelector('.plugin-name').textContent);
    title.id = 'feature-preview-title'; panel.setAttribute('aria-labelledby', title.id);
    const dismiss = node('button', 'button quiet preview-close', t('关闭', 'Close')); dismiss.type = 'button';
    dismiss.addEventListener('click', () => close({restore: pinned || panel.contains(document.activeElement)}));
    const heading = node('div', 'preview-heading'); heading.append(title, dismiss); panel.append(heading);
    const host = node('div', 'preview-media'); panel.append(host);
    const details = node('dl', 'preview-details');
    const labels = [t('出现位置', 'Location'), t('解决问题', 'Problem'), t('操作与效果', 'Action and result')];
    previewContent(card.dataset.featureId, locale).forEach((value, index) => {
      details.append(node('dt', '', labels[index]), node('dd', '', value));
    });
    const state = node('p', 'preview-resource-state', t('演示视频准备中', 'Demo video coming soon'));
    panel.append(details, state);
    panel.addEventListener('pointerenter', () => { hoveredPanel = true; clearTimeout(leaveTimer); });
    panel.addEventListener('pointerleave', () => { hoveredPanel = false; scheduleClose(); });
    panel.addEventListener('focusin', () => { clearTimeout(leaveTimer); });
    panel.addEventListener('focusout', event => { if (!panel?.contains(event.relatedTarget) && !current?.contains(event.relatedTarget)) close(); });
    document.querySelector('.dashboard-surface').append(panel);
    card.classList.add('is-previewing'); grid.classList.add('has-preview');
    const trigger = card.querySelector('.preview-entry'); trigger.setAttribute('aria-expanded', 'true'); trigger.setAttribute('aria-controls', panel.id);
    position(); void addMedia(card.dataset.featureId, host, state, generation);
  }
  function attach(card) {
    const entry = node('button', 'preview-entry'); entry.type = 'button'; entry.setAttribute('aria-expanded', 'false');
    entry.setAttribute('aria-label', `${t('查看效果', 'See how it works')} · ${card.querySelector('.plugin-name').textContent || card.dataset.featureId}`);
    card.append(entry);
    on(card, 'pointerenter', () => {
      if (!fine.matches) return;
      hoveredCard = card; pendingCard = card;

      clearTimeout(enterTimer); clearTimeout(leaveTimer);
      enterTimer = setTimeout(() => { pendingCard = null; open(card); }, 200);
    });
    on(card, 'pointerleave', () => {
      if (hoveredCard === card) hoveredCard = null;
      if (pendingCard === card) { clearTimeout(enterTimer); pendingCard = null; }
      scheduleClose();
    });
    on(entry, 'focus', () => { if (!restoring) open(card); });
    on(entry, 'click', () => open(card, true));
    on(card, 'focusout', event => { if (!card.contains(event.relatedTarget) && !panel?.contains(event.relatedTarget) && document.documentElement.dataset.input === 'keyboard') close(); });
  }
  on(document, 'keydown', event => {
    if (event.key === 'Escape' && current) { event.preventDefault(); const restore = pinned || panel.contains(document.activeElement); close({restore}); }
  });
  on(document, 'pointerdown', event => {
    if (!current) return;
    if (!current.contains(event.target) && !panel.contains(event.target)) close();
  });
  on(window, 'scroll', event => {
    if (panel?.contains(event.target)) return;
    close();
  }, {capture: true});
  on(window, 'resize', () => close());
  on(document, 'visibilitychange', () => { if (document.hidden) close(); });
  on(window, 'blur', () => close());
  on(document.querySelector('#data-dialog'), 'toggle', () => close());
  on(document.querySelector('#language-menu'), 'toggle', () => close());
  on(window, 'pagehide', () => { close(); lifetime.abort(); });
  function setLocale(next) {
    close(); locale = next; zh = locale === 'zh-CN';
    for (const card of grid.querySelectorAll('.plugin-card')) card.querySelector('.preview-entry')?.setAttribute('aria-label', `${t('查看效果', 'See how it works')} · ${card.querySelector('.plugin-name').textContent}`);
  }
  return {attach, close, setLocale};
}
