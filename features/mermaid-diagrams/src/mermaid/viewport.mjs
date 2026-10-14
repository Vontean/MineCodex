// 原生查看器负责缩放；此桥仅保留完整场景、转发 iframe 输入和恢复正文位置。
export function createMermaidViewport(root) {
  if (root.__mcxViewport) return root.__mcxViewport;
  let viewport = root.querySelector('.diagram-scroll'), scene = root.querySelector('.scene');
  if (!viewport || !scene) {
    viewport = document.createElement('div'); scene = document.createElement('div');
    viewport.className = 'diagram-scroll'; scene.className = 'scene'; scene.style.width = root.clientWidth + 'px';
    for (const child of [...root.children]) if (!['STYLE','H3'].includes(child.tagName)) scene.append(child);
    viewport.append(scene); root.append(viewport); scene.style.position = 'relative'; viewport.style.width = '100%';
  }
  const positions = new Map(), inlinePositions = new Map();
  let mode = window.openai?.displayMode || 'inline', restorePending = null, frame = 0, drag = null, suppressClick = false;
  const scope = () => root.dataset.scope || 'diagram';
  const expanded = () => mode === 'viewer';
  const send = detail => root.dispatchEvent(new CustomEvent('mcx:qv-viewer-input',{bubbles:true,detail}));
  function refresh() {
    root.dataset.displayMode = mode;
    if (expanded()) {
      viewport.style.paddingBottom = '0'; viewport.style.height = scene.offsetHeight + 'px';
      viewport.style.overflow = 'hidden'; viewport.style.cursor = 'grab'; viewport.style.touchAction = 'none'; viewport.scrollLeft = 0;
    } else {
      for (const key of ['height','overflow','touchAction','cursor','paddingBottom']) viewport.style[key] = '';
      if (restorePending) {
        viewport.scrollLeft = restorePending.left;
        if (viewport.scrollLeft === restorePending.left || viewport.clientWidth === restorePending.width) restorePending = null;
      }
    }
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame=0;refresh(); }); };
  const captureInline = () => { if (!expanded()) inlinePositions.set(scope(),{left:viewport.scrollLeft,width:viewport.clientWidth}); };
  captureInline();
  viewport.addEventListener('scroll',() => {const saved=inlinePositions.get(scope());if (!expanded()&&!restorePending&&(!saved||saved.width===viewport.clientWidth)) captureInline();},{passive:true});
  window.addEventListener('openai:set_globals',event => {
    const next = event.detail?.globals?.displayMode || window.openai?.displayMode || mode;
    if (next === mode) { schedule();return; }
    if (next === 'viewer') {const saved=inlinePositions.get(scope());positions.set(scope(),saved&&saved.width!==viewport.clientWidth?saved:{left:viewport.scrollLeft,width:viewport.clientWidth});}
    else restorePending = positions.get(scope()) || {left:0,width:viewport.clientWidth};
    mode = next; refresh();
    if (expanded()) root.getAnimations?.({subtree:true}).forEach(animation=>animation.cancel());
    // 只让关闭后的正文恢复原版几何，缩放与拖拽不触发图型重绘。
    if (!expanded()) root.dispatchEvent(new Event('qv:display-mode'));
  });
  viewport.addEventListener('wheel',event => {
    if (!expanded()) {captureInline();return;}
    event.preventDefault();event.stopPropagation();send({kind:'wheel',deltaY:event.deltaY,deltaMode:event.deltaMode,x:event.clientX,y:event.clientY});
  },{passive:false});
  viewport.addEventListener('pointerdown',event => {
    if (!expanded()) {captureInline();return;}
    if (event.button!==0 || event.target.closest('input,a')) return;
    suppressClick=false;drag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};send({kind:'start'});
  },true);
  viewport.addEventListener('pointermove',event => {
    if (!drag || drag.id!==event.pointerId) return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if (!drag.moved && Math.hypot(dx,dy)<5) return;
    if (!drag.moved) {drag.moved=true;viewport.setPointerCapture(event.pointerId);}
    event.preventDefault();event.stopImmediatePropagation();viewport.style.cursor='grabbing';send({kind:'drag',dx,dy});
  },true);
  const end=event => {
    if (!drag || drag.id!==event.pointerId) return;
    suppressClick=drag.moved;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    if (drag.moved) {event.preventDefault();event.stopImmediatePropagation();}
    drag=null;viewport.style.cursor=expanded()?'grab':'';send({kind:'end'});
  };
  viewport.addEventListener('pointerup',end,true);viewport.addEventListener('pointercancel',end,true);
  viewport.addEventListener('click',event => {if(suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('keydown',event => {
    if (!expanded() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,[contenteditable=true]')) return;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {event.preventDefault();send({kind:'pan',dx:event.key==='ArrowLeft'?-40:event.key==='ArrowRight'?40:0,dy:event.key==='ArrowUp'?-40:event.key==='ArrowDown'?40:0});}
  });
  const observer=new ResizeObserver(schedule);[root,viewport,scene].forEach(e=>observer.observe(e));
  root.__mcxViewport={refresh,get expanded(){return expanded();},get scale(){return 1;},get savedInlinePosition(){const saved=positions.get(scope());return saved?{...saved}:null;}};
  refresh();return root.__mcxViewport;
}
