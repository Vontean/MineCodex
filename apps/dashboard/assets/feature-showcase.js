import {previewContent} from './preview-content.js';

// 功能演示轮播：按卡片顺序自动播放各功能的真实录屏；点击卡片切换到对应功能。
export function installFeatureShowcase(root, locale) {
  let zh = locale === 'zh-CN';
  const t = (cn, en) => zh ? cn : en;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = selector => root.querySelector(selector);
  const media = $('.showcase-media'), video = $('.showcase-video'), poster = $('.showcase-poster'), status = $('.showcase-state');
  const count = $('.showcase-count'), name = $('.showcase-name'), details = $('.showcase-details'), progress = $('.showcase-progress');
  const prevButton = $('[data-showcase="prev"]'), nextButton = $('[data-showcase="next"]'), toggleButton = $('[data-showcase="toggle"]');
  let features = [], index = -1, generation = 0, mediaAbort = null, advanceTimer = 0, frame = 0;
  // userPaused 只由暂停按钮改变；inView / pageVisible 只暂停播放，不改变用户选择。
  let userPaused = reduced.matches, inView = false, pageVisible = !document.hidden, manifest;
  const cards = new Map();
  const urls = new Map();

  const loadManifest = () => manifest ??= window.minecodexPreviewMedia !== undefined
    ? Promise.resolve(window.minecodexPreviewMedia)
    : fetch('/assets/previews/manifest.json').then(r => r.ok ? r.json() : {}).then(value => value && typeof value === 'object' ? value : {}).catch(() => ({}));
  async function resourceUrl(id, kind, value, signal) {
    if (!window.minecodexMcpApp) return `/assets/previews/${value}`;
    const key = `${id}/${kind}`;
    if (urls.has(key)) return urls.get(key);
    const response = await window.minecodexMcpApp.readServerResource({uri:`resource://minecodex/previews/${id}/${kind}`}, {signal});
    const resource = response.contents?.[0];
    if (!resource?.blob) throw new Error('Preview resource unavailable');
    const url = `data:${resource.mimeType};base64,${resource.blob}`;
    urls.set(key, url);
    return url;
  }

  const shouldPlay = () => !userPaused && inView && pageVisible;
  const current = () => features[index];

  function renderControls() {
    const playing = !userPaused;
    toggleButton.querySelector('.ui-icon').className = `ui-icon ${playing ? 'pause-icon' : 'play-icon'}`;
    const label = playing ? t('暂停演示', 'Pause demos') : t('播放演示', 'Play demos');
    toggleButton.setAttribute('aria-label', label); toggleButton.setAttribute('data-minecodex-tooltip', label);
    for (const [button, cn, en] of [[prevButton, '上一个功能', 'Previous feature'], [nextButton, '下一个功能', 'Next feature']]) {
      button.setAttribute('aria-label', t(cn, en)); button.setAttribute('data-minecodex-tooltip', t(cn, en));
      button.disabled = features.length < 2;
    }
    root.setAttribute('aria-label', t('功能演示', 'Feature demos'));
  }
  function renderInfo() {
    const feature = current();
    if (!feature) return;
    const pad = n => String(n).padStart(2, '0');
    count.textContent = `${pad(index + 1)} / ${pad(features.length)}`;
    name.textContent = feature.label;
    details.replaceChildren();
    const labels = [t('出现位置', 'Where'), t('解决问题', 'Problem'), t('操作与效果', 'What it does')];
    previewContent(feature.id, locale).forEach((value, i) => {
      const dt = document.createElement('dt'); dt.textContent = labels[i];
      const dd = document.createElement('dd'); dd.textContent = value;
      details.append(dt, dd);
    });
    for (const [id, card] of cards) {
      const active = id === feature.id;
      card.classList.toggle('is-showcased', active);
      const entry = card.querySelector('.showcase-entry');
      if (active) entry?.setAttribute('aria-current', 'true'); else entry?.removeAttribute('aria-current');
    }
  }
  function renderProgress() {
    if (progress.children.length !== features.length) {
      progress.replaceChildren(...features.map(() => {
        const segment = document.createElement('span'); segment.className = 'showcase-segment';
        segment.append(Object.assign(document.createElement('span'), {className: 'showcase-fill'}));
        return segment;
      }));
    }
    [...progress.children].forEach((segment, i) => {
      segment.classList.toggle('is-done', i < index);
      segment.classList.toggle('is-current', i === index);
      if (i !== index) segment.firstChild.style.transform = i < index ? 'scaleX(1)' : 'scaleX(0)';
    });
  }
  // 当前段进度跟随视频时间；没有视频时停在起点。
  function tick() {
    cancelAnimationFrame(frame);
    const fill = progress.children[index]?.firstChild;
    if (fill && video.duration) fill.style.transform = `scaleX(${Math.min(1, video.currentTime / video.duration)})`;
    if (!video.paused) frame = requestAnimationFrame(tick);
  }

  function releaseVideo() {
    cancelAnimationFrame(frame); clearTimeout(advanceTimer);
    video.pause(); video.removeAttribute('src'); video.load(); video.hidden = true;
  }
  function sync() {
    clearTimeout(advanceTimer);
    if (!video.getAttribute('src')) {
      // 没有视频的功能只展示封面或说明，自动轮播时停留后前进。
      if (shouldPlay() && features.length > 1 && media.dataset.state !== 'loading') advanceTimer = setTimeout(() => step(1), 6000);
      return;
    }
    if (shouldPlay()) video.play().catch(() => { userPaused = true; renderControls(); });
    else video.pause();
  }
  async function select(nextIndex) {
    if (!features.length) return;
    index = (nextIndex + features.length) % features.length;
    const ticket = ++generation;
    mediaAbort?.abort(); mediaAbort = new AbortController();
    const signal = mediaAbort.signal;
    releaseVideo(); delete video.dataset.ready;
    renderInfo(); renderProgress();
    const feature = current();
    media.dataset.state = 'loading'; status.textContent = t('正在加载演示…', 'Loading demo…');
    poster.hidden = true; poster.removeAttribute('src');
    const resources = (await loadManifest())?.[feature.id];
    if (ticket !== generation) return;
    if (!resources) { media.dataset.state = 'empty'; status.textContent = t('演示视频准备中', 'Demo video coming soon'); sync(); return; }
    const [posterUrl, videoUrl] = await Promise.all(['poster', 'video'].map(kind => resources[kind] ? resourceUrl(feature.id, kind, resources[kind], signal).catch(() => null) : null));
    if (ticket !== generation) return;
    if (posterUrl) { poster.src = posterUrl; poster.hidden = false; }
    media.dataset.state = posterUrl ? 'poster' : 'empty';
    status.textContent = posterUrl ? '' : t('演示暂不可用', 'Demo unavailable');
    if (videoUrl) {
      video.src = videoUrl; video.hidden = false;
      video.addEventListener('loadeddata', () => { if (ticket === generation) { video.dataset.ready = '1'; media.dataset.state = 'video'; poster.hidden = true; } }, {once: true});
    }
    sync();
  }
  const step = delta => select(index + delta);

  video.addEventListener('play', tick);
  video.addEventListener('ended', () => {
    tick();
    if (shouldPlay()) advanceTimer = setTimeout(() => step(1), 600);
  });
  video.addEventListener('error', () => {
    if (!video.getAttribute('src')) return;
    releaseVideo(); poster.hidden = !poster.getAttribute('src');
    media.dataset.state = poster.hidden ? 'empty' : 'poster';
    status.textContent = poster.hidden ? t('演示暂不可用', 'Demo unavailable') : '';
    sync();
  });
  prevButton.addEventListener('click', () => step(-1));
  nextButton.addEventListener('click', () => step(1));
  toggleButton.addEventListener('click', () => {
    userPaused = !userPaused; renderControls();
    // 播完停在最后一帧时，继续播放从下一个功能开始。
    if (!userPaused && video.ended) step(1); else sync();
  });
  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, {threshold: 0.35}).observe(media);
  document.addEventListener('visibilitychange', () => { pageVisible = !document.hidden; sync(); });
  window.addEventListener('pagehide', () => { mediaAbort?.abort(); releaseVideo(); });

  function attach(card) {
    const entry = document.createElement('button');
    entry.type = 'button'; entry.className = 'showcase-entry';
    entry.setAttribute('aria-controls', root.id);
    entry.addEventListener('click', () => {
      const target = features.findIndex(feature => feature.id === card.dataset.featureId);
      if (target < 0) return;
      if (target !== index) void select(target);
      const box = root.getBoundingClientRect();
      if (box.top < 0 || box.bottom > innerHeight) root.scrollIntoView({block: 'center', behavior: reduced.matches ? 'auto' : 'smooth'});
    });
    card.append(entry);
    cards.set(card.dataset.featureId, card);
  }
  function detach(card) { cards.delete(card.dataset.featureId); }
  function labelEntries() {
    for (const card of cards.values()) card.querySelector('.showcase-entry')?.setAttribute('aria-label', `${t('在演示中查看', 'Show in demo')} · ${card.querySelector('.plugin-name').textContent || card.dataset.featureId}`);
  }
  function setFeatures(next) {
    const id = current()?.id;
    features = next.map(({id, label}) => ({id, label}));
    root.hidden = features.length === 0;
    renderControls(); labelEntries();
    const kept = features.findIndex(feature => feature.id === id);
    if (kept >= 0) { index = kept; renderInfo(); renderProgress(); }
    else void select(0);
  }
  function setLocale(next) {
    locale = next; zh = locale === 'zh-CN';
    renderControls(); renderInfo(); labelEntries();
  }
  renderControls();
  return {attach, detach, setFeatures, setLocale};
}
