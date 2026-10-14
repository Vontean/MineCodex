import { captureMarkdownProviders } from '../../../../../packages/codex-adapter/src/markdown/providers.mjs';

// Markdown 负责标题与导航；原生组件负责短线、动效、浮层材质与悬浮定位。
export function installMarkdownToc(view, api, native, codex) {
  const { React, ReactDOM, Marker, Panel, Tooltip, classes, indentation } = native;
  const h = React.createElement;
  const compartment = new api.Compartment();
  const controller = new AbortController(),
    { signal } = controller;
  const mount = document.createElement('div');
  const panel = view.dom.closest('[data-app-shell-tab-panel-controller]');
  mount.dataset.mcxReadingToc = '';
  mount.style.display = 'contents';
  view.dom.append(mount);
  const withProviders = captureMarkdownProviders(view.dom, codex);
  const root = ReactDOM.createRoot(mount);
  let headings = [],
    active = null,
    visible = false,
    frame = null,
    navigationFrame = null,
    navigating = false,
    scrollTimer = null;
  const scrollBehavior = view.scrollDOM.style.scrollBehavior;
  function restoreScroll() {
    clearTimeout(scrollTimer);
    if (navigationFrame !== null) cancelAnimationFrame(navigationFrame);
    navigationFrame = null;
    view.scrollDOM.style.scrollBehavior = scrollBehavior;
  }
  function navigate(heading, behavior) {
    restoreScroll();
    active = heading.id;
    navigating = true;
    render();
    const start = view.scrollDOM.scrollTop;
    view.scrollDOM.style.scrollBehavior = 'auto';
    view.dispatch({ effects: view.constructor.scrollIntoView(heading.from, { y: 'start', yMargin: 24 }) });
    if (behavior !== 'instant' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigationFrame = requestAnimationFrame(() => {
        navigationFrame = requestAnimationFrame(() => {
          navigationFrame = null;
          const destination = view.scrollDOM.scrollTop;
          view.scrollDOM.scrollTo({ top: start, behavior: 'instant' });
          view.scrollDOM.scrollTo({ top: destination, behavior: 'smooth' });
        });
      });
    }
    scrollTimer = setTimeout(() => {
      restoreScroll();
      navigating = false;
      schedule();
    }, 1200);
  }
  function reveal(container, item) {
    if (!container || !item) return;
    let top = item.offsetTop;
    for (
      let parent = item.offsetParent;
      parent instanceof HTMLElement && parent !== container && parent !== container.offsetParent;
      parent = parent.offsetParent
    )
      top += parent.offsetTop;
    if (top < container.scrollTop) container.scrollTop = top;
    else if (top + item.offsetHeight > container.scrollTop + container.clientHeight)
      container.scrollTop = top + item.offsetHeight - container.clientHeight + 1;
  }
  function Contents({ headings, active }) {
    const [preview, setPreview] = React.useState(null),
      [scrub, setScrub] = React.useState(null);
    const rail = React.useRef(null),
      list = React.useRef(null),
      pointer = React.useRef(null),
      dragged = React.useRef(false);
    React.useEffect(() => {
      if (!pointer.current)
        reveal(rail.current, rail.current?.querySelector(`[data-page-heading-id="${preview ?? active}"]`));
    }, [preview, active]);
    function end(event) {
      const p = pointer.current;
      if (p?.pointerId !== event.pointerId) return;
      pointer.current = null;
      setScrub(null);
      if (p.target.hasPointerCapture?.(event.pointerId)) p.target.releasePointerCapture(event.pointerId);
      if (event.type === 'pointercancel' || event.type === 'lostpointercapture') dragged.current = false;
    }
    function move(event) {
      const p = pointer.current;
      if (!p || p.pointerId !== event.pointerId) return;
      if (event.buttons % 2 === 0) {
        end(event);
        return;
      }
      const element = event.currentTarget,
        rect = element.getBoundingClientRect();
      const button = document
        .elementFromPoint(
          rect.left + rect.width / 2,
          Math.max(rect.top, Math.min(event.clientY, rect.bottom - 1)),
        )
        ?.closest('[data-page-heading-id]');
      if (!button || !element.contains(button)) return;
      const heading = headings.find((h) => h.id === button.dataset.pageHeadingId);
      if (heading && heading.id !== p.headingId) {
        p.headingId = heading.id;
        dragged.current = true;
        setScrub(heading.id);
        setPreview(heading.id);
        navigate(heading, 'instant');
      }
    }
    const railTree = h(
      'div',
      {
        ref: rail,
        className: classes.rail,
        'data-floating-navigation-rail-list': true,
        'data-scrubbing': scrub != null || undefined,
        onPointerMove: move,
        onPointerUp: end,
        onPointerCancel: end,
        onLostPointerCapture: end,
      },
      headings.map((heading, index) =>
        h(
          'button',
          {
            key: heading.id,
            type: 'button',
            className: classes.railButton,
            'aria-current': active === heading.id ? 'true' : undefined,
            'aria-label': `Jump to heading ${index + 1}: ${heading.title}`,
            'data-page-heading-id': heading.id,
            'data-scrub-target': (scrub ?? preview) === heading.id || undefined,
            onPointerDown: (event) => {
              if (event.button === 0 && !pointer.current) {
                dragged.current = false;
                pointer.current = {
                  pointerId: event.pointerId,
                  target: event.currentTarget,
                  headingId: heading.id,
                };
                setScrub(heading.id);
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }
            },
            onClick: (event) => {
              if (dragged.current && event.detail !== 0) {
                dragged.current = false;
                return;
              }
              navigate(heading);
            },
            onPointerEnter: () => setPreview(heading.id),
            onFocus: () => setPreview(heading.id),
          },
          h(Marker, { hierarchyLevel: Math.min(heading.level, 3) }),
        ),
      ),
    );
    const current = preview ?? active;
    const listTree = h(
      Panel,
      {
        ref: (element) => {
          list.current = element;
          reveal(element, element?.querySelector('[data-heading-preview]'));
        },
        className: classes.menu,
      },
      headings.map((heading) =>
        h(
          'button',
          {
            key: heading.id,
            type: 'button',
            ref: (element) => {
              if (current === heading.id) reveal(list.current, element);
            },
            'aria-current': active === heading.id ? 'location' : undefined,
            'data-heading-preview': current === heading.id ? '' : undefined,
            className: `${classes.menuButton} ${active === heading.id ? 'text-default' : 'text-secondary'} ${preview === heading.id ? 'bg-background-primary-ghost-hover/50' : ''}`,
            onClick: () => navigate(heading),
            onPointerEnter: () => setPreview(heading.id),
            onFocus: () => setPreview(heading.id),
          },
          h('span', { className: `block ${indentation[Math.min(heading.level, 3)] ?? ''}` }, heading.title),
        ),
      ),
    );
    return h(
      'nav',
      {
        'aria-label': '文档目录',
        className: classes.nav,
        style: { top: 'var(--mcx-reading-toc-center, 50%)' },
      },
      h(
        Tooltip,
        {
          align: 'center',
          delayOpen: true,
          interactive: true,
          side: 'right',
          sideOffset: 0,
          skipDelayKey: 'page-table-of-contents',
          tooltipMaxWidth: 'min(20rem, calc(100vw - 16px))',
          variant: 'floating-navigation-rail',
          onPointerLeave: () => {
            if (!list.current) setPreview(null);
          },
          onOpenChange: (open) => {
            if (!open) setPreview(null);
          },
          tooltipContent: listTree,
        },
        railTree,
      ),
    );
  }
  function render() {
    let tree = visible ? h(Contents, { headings, active }) : null;
    root.render(withProviders(React, tree));
  }
  function build() {
    const next = [],
      text = view.state.doc.toString();
    const frontmatter = /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(text);
    view.state.tree.iterate({
      enter(node) {
        const match = /^(?:ATXHeading|SetextHeading)([1-6])$/.exec(node.name);
        if (
          !match ||
          (frontmatter && node.from < frontmatter[0].length) ||
          node.node.parent?.name !== 'Document'
        )
          return;
        const omit = [];
        node.node.toTree().iterate({
          enter(child) {
            if (
              /^(HeaderMark|EmphasisMark|StrikethroughMark|CodeMark|LinkMark|URL|LinkTitle)$/.test(child.name)
            )
              omit.push([node.from + child.from, node.from + child.to]);
          },
        });
        let title = '',
          cursor = node.from;
        for (const [from, to] of omit.sort((a, b) => a[0] - b[0]))
          if (from >= cursor) {
            title += view.state.sliceDoc(cursor, from);
            cursor = to;
          }
        title = (title + view.state.sliceDoc(cursor, node.to)).replace(/\s+/g, ' ').trim();
        if (title) next.push({ id: `heading-${node.from}`, from: node.from, level: Number(match[1]), title });
        return false;
      },
    });
    if (JSON.stringify(next) !== JSON.stringify(headings)) {
      headings = next;
      render();
    }
  }
  function update() {
    frame = null;
    const scroller = view.scrollDOM,
      rect = scroller.getBoundingClientRect(),
      scale = rect.width / scroller.offsetWidth || 1;
    // 以整个 File Panel（含 Toolbar）的中心锚定，换算回编辑器局部坐标。
    if (panel) {
      const panelRect = panel.getBoundingClientRect(),
        editorRect = view.dom.getBoundingClientRect();
      const editorScale = editorRect.height / view.dom.offsetHeight || 1;
      mount.style.setProperty(
        '--mcx-reading-toc-center',
        `${(panelRect.top + panelRect.height / 2 - editorRect.top) / editorScale}px`,
      );
    }
    const nextVisible =
      headings.length >= 2 && (view.contentDOM.getBoundingClientRect().left - rect.left) / scale >= 112;
    if (!navigating && headings.length) {
      const position = view.lineBlockAtHeight(Math.max(0, rect.top + 24 * scale - view.documentTop)).from;
      active = headings[0].id;
      for (const heading of headings) {
        if (heading.from > position) break;
        active = heading.id;
      }
      if (scroller.scrollTop > 0 && scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= 1)
        active = headings.at(-1).id;
    }
    visible = nextVisible;
    render();
  }
  function schedule() {
    if (frame === null) frame = requestAnimationFrame(update);
  }
  view.scrollDOM.addEventListener('scroll', schedule, { signal, passive: true });
  for (const type of ['scrollend', 'wheel', 'touchstart', 'pointerdown', 'keydown'])
    view.scrollDOM.addEventListener(
      type,
      () => {
        navigating = false;
        restoreScroll();
        schedule();
      },
      { signal, passive: true },
    );
  const resize = new ResizeObserver(schedule);
  resize.observe(view.dom);
  resize.observe(view.contentDOM);
  if (panel) resize.observe(panel);
  const plugin = api.ViewPlugin.fromClass(
    class {
      update(update) {
        if (update.docChanged || update.viewportChanged || update.startState.tree !== update.state.tree) {
          build();
          schedule();
        }
      }
    },
  );
  view.dispatch({ effects: api.StateEffect.appendConfig.of(compartment.of(plugin)) });
  build();
  schedule();
  return () => {
    controller.abort();
    resize.disconnect();
    restoreScroll();
    if (frame !== null) cancelAnimationFrame(frame);
    root.unmount();
    mount.remove();
    if (!view.destroyed) view.dispatch({ effects: compartment.reconfigure([]) });
  };
}
