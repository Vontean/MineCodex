// 视口适配只改变展示比例，不改图模型和布局坐标。
function createMermaidViewport(root, { expandedSizing = 'fit' } = {}) {
  const viewport = root.querySelector('.diagram-scroll'), scene = root.querySelector('.scene');
  const scrollPositions = new Map(), inlinePositions = new Map();
  let restorePending = null;
  let mode = window.openai?.displayMode || 'inline', maxHeight = window.openai?.maxHeight;
  let scale = 1, frame = 0;
  const scope = () => root.dataset.scope || 'diagram';
  function refresh() {
    const width = scene.offsetWidth, height = scene.offsetHeight;
    if (!width || !height) return;
    root.dataset.displayMode = mode;
    if (mode === 'fullscreen') {
      const chrome = root.offsetHeight - viewport.offsetHeight;
      const available = Math.max(120, (Number(maxHeight) || window.innerHeight) - chrome - 24);
      // Hug 按内容高度展开，避免长图在放大后反而缩小文字。
      scale = expandedSizing === 'hug' ? 1 : Math.min(1, viewport.clientWidth / width, available / height);
      scene.style.transformOrigin = '0 0';
      scene.style.transform = `scale(${scale})`;
      scene.style.marginLeft = Math.max(0, (viewport.clientWidth - width * scale) / 2) + 'px';
      viewport.style.height = Math.ceil(height * scale) + 'px';
      viewport.style.overflow = expandedSizing === 'hug' ? 'auto' : 'hidden';
      viewport.scrollLeft = 0;
    } else {
      scale = 1;
      scene.style.transform = '';
      scene.style.marginLeft = '';
      viewport.style.height = '';
      viewport.style.overflow = '';
      if(restorePending){viewport.scrollLeft=restorePending.left;if(viewport.scrollLeft===restorePending.left||viewport.clientWidth===restorePending.width){inlinePositions.set(scope(),{left:viewport.scrollLeft,width:restorePending.width});restorePending=null;}}
    }
    root.dataset.viewportScale = String(scale);
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; refresh(); });
  }
  window.addEventListener('openai:set_globals', event => {
    const globals = event.detail?.globals || {};
    const next = globals.displayMode || window.openai?.displayMode || mode;
    maxHeight = globals.maxHeight ?? window.openai?.maxHeight ?? maxHeight;
    if (next !== mode) {
      if (next === 'fullscreen') {const saved=inlinePositions.get(scope());scrollPositions.set(scope(),saved&&saved.width!==viewport.clientWidth?saved:{left:viewport.scrollLeft,width:viewport.clientWidth});}
      if(next === 'inline') restorePending=scrollPositions.get(scope())||{left:0,width:viewport.clientWidth};
      mode = next;
      refresh();

      root.dispatchEvent(new Event('qv:display-mode'));
    } else schedule();
  });
  // 容器先扩宽会把scrollLeft夹小；保存最后一次同宽滚动，避免把该夹值当用户位置。
  const captureInline=()=>{if(mode==='inline')inlinePositions.set(scope(),{left:viewport.scrollLeft,width:viewport.clientWidth});};
  captureInline();
  viewport.addEventListener('scroll',()=>{const saved=inlinePositions.get(scope());if(mode==='inline'&&!restorePending&&(!saved||saved.width===viewport.clientWidth))captureInline();},{passive:true});
  for(const event of ['pointerdown','wheel','keydown'])viewport.addEventListener(event,captureInline,{passive:true});
  const observer = new ResizeObserver(schedule);
  [root, viewport, scene].forEach(element => observer.observe(element));
  return {
    refresh,
    get expanded() { return mode === 'fullscreen'; },
    get scale() { return scale; },
    get savedInlinePosition() { const saved=scrollPositions.get(scope());return saved?{...saved}:null; }
  };
}
