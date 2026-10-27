// 操作栏锚定阅读区域；表格横向展开与滚动不改变恢复按钮的位置。
export function markdownTableActionGeometry(first, last, frame, scale, scrollTop, padding, headerInset) {
  const left = padding.left;
  const width = Math.max(0, frame.width / scale - padding.left - padding.right);
  const viewportTop = Math.max(0, (first.top - frame.top) / scale + headerInset - 40);
  const visibleBottom = (Math.min(last.bottom, frame.bottom) - frame.top) / scale;
  return {left, width, top: scrollTop + Math.min(viewportTop, Math.max(0, visibleBottom - 48)),
    inView: last.bottom > frame.top && first.top < frame.bottom};
}

// 保留原生逐行表格及选区；每张表的行共享横向位置，不移动正文节点。
export function installMarkdownTables(view, api, wrapState) {
  const { Decoration, ViewPlugin, StateEffect, Compartment, WidgetType } = api;
  class EmptyCell extends WidgetType {
    eq() {
      return true;
    }
    toDOM() {
      const span = document.createElement('span');
      span.className = 'cm-markdown-table-cell mcx-reading-table-empty';
      span.setAttribute('aria-label', '空单元格');
      return span;
    }
    ignoreEvent() {
      return false;
    }
  }
  function slots(state, row) {
    const result = [];
    const delimiters = row.getChildren('TableDelimiter');
    let start = row.from;
    for (const delimiter of delimiters) {
      if (start === row.from && !state.sliceDoc(start, delimiter.from).trim()) {
        start = delimiter.to;
        continue;
      }
      result.push({ from: start, to: delimiter.from });
      start = delimiter.to;
    }
    if (state.sliceDoc(start, row.to).trim() || !delimiters.length) result.push({ from: start, to: row.to });
    return result;
  }
  function build(editor) {
    const ranges = [];
    editor.state.tree.iterate({
      from: editor.viewport.from,
      to: editor.viewport.to,
      enter(node) {
        if (node.name !== 'Table') return;
        const table = node.node;
        const header = table.getChild('TableHeader');
        if (!header) return false;
        const rows = [header, ...table.getChildren('TableRow')];
        const count = Math.max(...rows.map((row) => slots(editor.state, row).length));
        if (!count) return false;
        for (let index = 0; index < rows.length; index++) {
          const row = rows[index];
          if (row.to < editor.viewport.from || row.from > editor.viewport.to) continue;
          ranges.push(
            Decoration.line({
              class: `mcx-reading-table-row horizontal-scroll-fade-mask horizontal-scroll-fade-mask-eased${index === rows.length - 1 ? ' mcx-reading-table-last' : ''}`,
              attributes: {
                'data-mcx-reading-table': String(table.from),
              },
            }).range(editor.state.doc.lineAt(row.from).from),
          );
          const columns = slots(editor.state, row);
          const cells = row.getChildren('TableCell');
          for (let column = 0; column < count; column++) {
            const slot = columns[column];
            if (!slot || !cells.some((cell) => cell.from >= slot.from && cell.to <= slot.to)) {
              ranges.push(
                Decoration.widget({ widget: new EmptyCell(), side: 1 + column }).range(slot?.from ?? row.to),
              );
            }
          }
        }
        return false;
      },
    });
    return Decoration.set(ranges, true);
  }
  // 隐藏的原生 table 只负责浏览器列宽计算；正文仍由 CodeMirror 持有。
  const measure = document.createElement('div');
  measure.className = 'mcx-reading-table-measure';
  measure.setAttribute('aria-hidden', 'true');
  measure.inert = true;
  view.dom.append(measure);
  const layoutStyle = document.createElement('style');
  const scope = `table-${Math.random().toString(36).slice(2)}`;
  view.dom.dataset.mcxReadingTableScope = scope;
  view.dom.append(layoutStyle);
  let measuredDoc = null;
  const tables = new Map();
  let hovered = null;
  function inline(state, node, target) {
    let cursor = node.from;
    for (let child = node.firstChild; child; child = child.nextSibling) {
      target.append(document.createTextNode(state.sliceDoc(cursor, child.from)));
      if (
        !/^(EmphasisMark|CodeMark|LinkMark)$/.test(child.name) &&
        !(child.name === 'URL' && node.name === 'Link' && state.sliceDoc(node.from, node.from + 1) === '[')
      ) {
        const tag = {
          StrongEmphasis: 'strong',
          Emphasis: 'em',
          InlineCode: 'code',
          Link: 'a',
          Strikethrough: 's',
        }[child.name];
        if (child.name === 'Escape')
          target.append(document.createTextNode(state.sliceDoc(child.from + 1, child.to)));
        else if (child.name === 'Entity') {
          const decoder = document.createElement('textarea');
          decoder.innerHTML = state.sliceDoc(child.from, child.to);
          target.append(document.createTextNode(decoder.value));
        } else {
          const element = tag ? document.createElement(tag) : target;
          inline(state, child, element);
          if (tag) target.append(element);
        }
      }
      cursor = child.to;
    }
    target.append(document.createTextNode(state.sliceDoc(cursor, node.to)));
  }
  function measureColumns() {
    if (measuredDoc !== view.state.doc) {
      measure.replaceChildren();
      tables.clear();
      view.state.tree.iterate({
        enter(node) {
          if (node.name !== 'Table') return;
          const header = node.node.getChild('TableHeader');
          if (!header) return false;
          const rows = [header, ...node.node.getChildren('TableRow')];
          const count = Math.max(...rows.map((row) => slots(view.state, row).length));
          const table = document.createElement('table');
          const body = table.createTBody();
          for (const [index, row] of rows.entries()) {
            const tr = body.insertRow();
            const columns = slots(view.state, row);
            const cells = row.getChildren('TableCell');
            for (let col = 0; col < count; col++) {
              const td = document.createElement(index === 0 ? 'th' : 'td');
              const slot = columns[col];
              const cell = slot && cells.find((cell) => cell.from >= slot.from && cell.to <= slot.to);
              if (cell) inline(view.state, cell, td);
              tr.append(td);
            }
          }
          table.dataset.to = String(node.node.to);
          measure.append(table);
          tables.set(String(node.from), table);
          return false;
        },
      });
      measuredDoc = view.state.doc;
    }
    const content = view.contentDOM;
    const scroller = view.scrollDOM;
    const padding = getComputedStyle(scroller);
    const wrapping = wrapState.get();
    measure.style.width = wrapping
      ? `${scroller.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight)}px`
      : "";
    const available = measure.clientWidth;
    const inset = (scroller.clientWidth - available) / 2;
    const breakout = wrapping ? 0 : Math.max(0, parseFloat(padding.paddingLeft) - inset);
    for (const [id, table] of tables) {
      table.style.inlineSize = wrapState.get() ? '100%' : 'max-content';
      for (const cell of table.querySelectorAll('td,th'))
        cell.style.overflowWrap = wrapState.get() ? 'anywhere' : 'break-word';
    }
    const widths = new Map(
      [...tables].map(([id, table]) => [
        id,
        [...table.rows[0].cells].map((cell) => cell.getBoundingClientRect().width),
      ]),
    );
    const rules = [];
    for (const [id, columns] of widths) {
      const selector = `[data-mcx-reading-table-scope="${scope}"] [data-mcx-reading-table="${id}"]`;
      rules.push(
        `${selector}{width:${available}px;margin-inline:${-breakout}px;${columns.reduce((a, b) => a + b, 0) <= available ? 'animation:none;mask:none;' : ''}}`,
      );
      columns.forEach((width, index) =>
        rules.push(
          `${selector} > .cm-markdown-table-cell:nth-child(${index + 1} of .cm-markdown-table-cell){width:${width}px;overflow-wrap:${wrapState.get() ? 'anywhere' : 'break-word'}}`,
        ),
      );
    }
    const codeClasses = new Set();
    for (const span of content.querySelectorAll('.cm-markdown-table-cell span[class]')) {
      if (getComputedStyle(span).fontFamily.includes('monospace'))
        for (const name of span.classList) codeClasses.add(name);
    }
    for (const name of codeClasses)
      rules.push(
        `[data-mcx-reading-table-scope="${scope}"] .cm-markdown-table-cell .${CSS.escape(name)}{font-size:.92em;font-weight:400;padding:1px 6px;border-radius:6px;background:color-mix(in srgb,var(--color-background-primary-ghost-hover) 60%,var(--color-text) 6%);box-decoration-break:clone;overflow-wrap:anywhere;word-break:break-word;}`,
      );
    const css = rules.join('\n');
    if (layoutStyle.textContent !== css) {
      layoutStyle.textContent = css;
      view.requestMeasure();
    }
  }
  const offsets = new Map();
  const scrollbars = new Map();
  const scrollLimits = new Map();
  const scrollGeometryStyle = document.createElement('style');
  view.dom.append(scrollGeometryStyle);
  function updateScrollbars() {
    const visible = new Set();
    const frameRect = view.scrollDOM.getBoundingClientRect();
    const scale = frameRect.height / view.scrollDOM.offsetHeight || 1;
    for (const last of view.contentDOM.querySelectorAll('.mcx-reading-table-last')) {
      const id = last.dataset.mcxReadingTable;
      if (last.scrollWidth <= last.clientWidth + 1) continue;
      visible.add(id);
      let bar = scrollbars.get(id);
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'mcx-reading-table-scrollbar';
        bar.dataset.mcxReadingTableScrollbar = id;
        bar.setAttribute('aria-label', '表格横向滚动');
        bar.tabIndex = 0;
        bar.setAttribute('role', 'scrollbar');
        bar.setAttribute('aria-orientation', 'horizontal');
        bar.setAttribute('aria-valuemin', '0');
        bar.append(document.createElement('div'));
        bar.addEventListener(
          'wheel',
          (event) => {
            const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.scrollDOM.clientHeight : 1;
            event.preventDefault();
            if (event.deltaX || event.shiftKey) bar.scrollLeft += (event.deltaX || event.deltaY) * unit;
            else view.scrollDOM.scrollTop += event.deltaY * unit;
          },
          { passive: false },
        );
        bar.addEventListener('keydown', (event) => {
          const targets = {
            ArrowLeft: bar.scrollLeft - 40,
            ArrowRight: bar.scrollLeft + 40,
            PageUp: bar.scrollLeft - bar.clientWidth,
            PageDown: bar.scrollLeft + bar.clientWidth,
            Home: 0,
            End: bar.scrollWidth,
          };
          if (event.key in targets) {
            event.preventDefault();
            bar.scrollLeft = targets[event.key];
          }
        });
        bar.addEventListener('scroll', () => {
          offsets.set(id, bar.scrollLeft);
          for (const row of view.contentDOM.querySelectorAll('[data-mcx-reading-table]'))
            if (row.dataset.mcxReadingTable === id) row.scrollLeft = bar.scrollLeft;
          schedule();
          view.requestMeasure();
        });
        view.scrollDOM.append(bar);
        scrollbars.set(id, bar);
      }
      const rect = last.getBoundingClientRect();
      bar.dataset.visible = String(hovered === id);
      Object.assign(bar.style, {
        left: `${(rect.left - frameRect.left) / scale}px`,
        top: `${(rect.bottom - frameRect.top) / scale - parseFloat(getComputedStyle(last).paddingBottom) + view.scrollDOM.scrollTop}px`,
        width: `${last.clientWidth}px`,
      });
      bar.firstElementChild.style.width = `${last.scrollWidth}px`;
      bar.scrollLeft = offsets.get(id) ?? 0;
      bar.setAttribute('aria-valuemax', String(bar.scrollWidth - bar.clientWidth));
      bar.setAttribute('aria-valuenow', String(Math.round(bar.scrollLeft)));
    }
    for (const [id, bar] of scrollbars)
      if (!visible.has(id)) {
        bar.remove();
        scrollbars.delete(id);
      }
  }
  let frame = null;
  let revealCursor = false;
  let geometryRows = [],
    geometryColumns = '';
  const restore = () => {
    frame = null;
    if (view.destroyed) return;
    measureColumns();
    const currentRows = [...view.contentDOM.querySelectorAll('[data-mcx-reading-table]')];
    const geometryChanged =
      geometryColumns !== layoutStyle.textContent ||
      currentRows.length !== geometryRows.length ||
      currentRows.some((row, index) => row !== geometryRows[index]);
    if (geometryChanged) {
      geometryRows = currentRows;
      geometryColumns = layoutStyle.textContent;
      scrollGeometryStyle.textContent = '';
      const groups = new Map();
      for (const row of view.contentDOM.querySelectorAll('[data-mcx-reading-table]')) {
        const id = row.dataset.mcxReadingTable;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(row);
      }
      const scrollRules = [];
      scrollLimits.clear();
      for (const [id, rows] of groups) {
        const width = Math.max(...rows.map((row) => row.scrollWidth));
        const limit = Math.max(0, width - rows[0].clientWidth);
        scrollLimits.set(id, limit > 1 ? limit : 0);
        offsets.set(id, Math.min(offsets.get(id) ?? 0, limit > 1 ? limit : 0));
        scrollRules.push(
          `[data-mcx-reading-table-scope="${scope}"] [data-mcx-reading-table="${id}"]{--mcx-table-scroll-width:${width}px}`,
        );
      }
      scrollGeometryStyle.textContent = scrollRules.join('\n');
    }
    for (const row of view.contentDOM.querySelectorAll('[data-mcx-reading-table]')) {
      const offset = offsets.get(row.dataset.mcxReadingTable) ?? 0;
      if (row.scrollLeft !== offset) row.scrollLeft = offset;
    }
    updateScrollbars();
    if (controller.renderActions) {
      const frameRect = view.scrollDOM.getBoundingClientRect(),
        items = [];
      const scale = frameRect.height / view.scrollDOM.offsetHeight || 1;
      for (const [id, table] of tables) {
        const rows = [...view.contentDOM.querySelectorAll('[data-mcx-reading-table]')].filter(
          (row) => row.dataset.mcxReadingTable === id,
        );
        if (!rows.length) continue;
        const first = rows[0].getBoundingClientRect();
        const headerInset = parseFloat(getComputedStyle(rows[0]).paddingTop);
        const padding = getComputedStyle(view.scrollDOM);
        const geometry = markdownTableActionGeometry(first, rows.at(-1).getBoundingClientRect(), frameRect, scale,
          view.scrollDOM.scrollTop, {left:parseFloat(padding.paddingLeft),right:parseFloat(padding.paddingRight)}, headerInset);
        items.push({
          id,
          fit: wrapState.get(),
          overflow: (scrollLimits.get(id) ?? 0) > 0,
          // 关闭换行后常显恢复入口；键盘用户聚焦任一表格控件也保持显示。
          visible: geometry.inView && (hovered === id || tableId(document.activeElement) === id || !wrapState.get()),
          left: geometry.left,
          top: geometry.top,
          width: geometry.width,
          source: view.state.sliceDoc(Number(id), Number(table.dataset.to)),
        });
      }
      controller.renderActions(items);
    }
    const shouldReveal = revealCursor;
    revealCursor = false;
    if (shouldReveal && view.hasFocus && view.state.selection.main.empty) {
      const pos = view.state.selection.main.head;
      const dom = view.domAtPos(pos).node;
      const row = (dom.nodeType === 1 ? dom : dom.parentElement)?.closest('[data-mcx-reading-table]');
      const cursor = view.coordsAtPos(pos);
      if (row && cursor) {
        const rect = row.getBoundingClientRect();
        const scale = rect.width / row.offsetWidth;
        const delta =
          cursor.left < rect.left + 12
            ? cursor.left - rect.left - 12
            : cursor.right > rect.right - 12
              ? cursor.right - rect.right + 12
              : 0;
        if (delta) {
          const offset = Math.max(
            0,
            Math.min(row.scrollWidth - row.clientWidth, row.scrollLeft + delta / scale),
          );
          offsets.set(row.dataset.mcxReadingTable, offset);
          for (const sibling of view.contentDOM.querySelectorAll('[data-mcx-reading-table]'))
            if (sibling.dataset.mcxReadingTable === row.dataset.mcxReadingTable) sibling.scrollLeft = offset;
          view.requestMeasure();
        }
      }
    }
  };
  const schedule = () => {
    if (frame === null) frame = requestAnimationFrame(restore);
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(view.dom);
  // 阻止命中行先由 compositor 滚动；一次输入同步提交全表偏移。
  const onWheel = (event) => {
    if (event.ctrlKey || !event.cancelable) return;
    const row = event.target instanceof Element ? event.target.closest('[data-mcx-reading-table]') : null;
    const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0);
    if (!row || !delta) return;
    event.preventDefault();
    event.stopPropagation();
    const id = row.dataset.mcxReadingTable;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? row.clientWidth : 1;
    const offset = Math.max(0, Math.min(scrollLimits.get(id) ?? 0, (offsets.get(id) ?? 0) + delta * unit));
    offsets.set(id, offset);
    for (const sibling of view.contentDOM.querySelectorAll('[data-mcx-reading-table]')) {
      if (sibling.dataset.mcxReadingTable === id) sibling.scrollLeft = offset;
    }
    const bar = scrollbars.get(id);
    if (bar) bar.scrollLeft = offset;
    if (event.deltaX && event.deltaY && !event.shiftKey) view.scrollDOM.scrollTop += event.deltaY * unit;
    schedule();
    view.requestMeasure();
  };
  const onScroll = (event) => {
    const row = event.target;
    if (!row.matches?.('[data-mcx-reading-table]')) return;
    const id = row.dataset.mcxReadingTable;
    if (!scrollLimits.get(id)) {
      offsets.set(id, 0);
      if (row.scrollLeft) row.scrollLeft = 0;
      return;
    }
    if (Math.abs((offsets.get(id) ?? 0) - row.scrollLeft) < 0.5) return;
    offsets.set(id, row.scrollLeft);
    const bar = scrollbars.get(id);
    if (bar) bar.scrollLeft = row.scrollLeft;
    for (const sibling of view.contentDOM.querySelectorAll('[data-mcx-reading-table]'))
      if (sibling.dataset.mcxReadingTable === id && sibling !== row) sibling.scrollLeft = row.scrollLeft;
    view.requestMeasure();
  };
  const tableId = (target) =>
    target instanceof Element
      ? (target
          .closest(
            '[data-mcx-reading-table],[data-mcx-reading-table-action-id],[data-mcx-reading-table-scrollbar]',
          )
          ?.getAttribute('data-mcx-reading-table') ??
        target.closest('[data-mcx-reading-table-action-id]')?.dataset.mcxReadingTableActionId ??
        target.closest('[data-mcx-reading-table-scrollbar]')?.dataset.mcxReadingTableScrollbar)
      : null;
  const onHover = (event) => {
    const id = tableId(event.type === 'pointerout' ? event.relatedTarget : event.target);
    if (hovered !== id) {
      hovered = id;
      schedule();
    }
  };
  view.dom.addEventListener('pointerover', onHover);
  view.dom.addEventListener('pointerout', onHover);
  view.dom.addEventListener('focusin', schedule);
  view.dom.addEventListener('focusout', schedule);
  view.contentDOM.addEventListener('scroll', onScroll, true);
  view.contentDOM.addEventListener('wheel', onWheel, { capture: true, passive: false });
  view.scrollDOM.addEventListener('scroll', schedule, { passive: true });
  const plugin = ViewPlugin.define(
    (editor) => ({
      decorations: build(editor),
      update(update) {
        if (update.docChanged) {
          offsets.clear();
          geometryRows = [];
        }
        if (update.docChanged || update.startState.tree !== update.state.tree) measuredDoc = null;
        if (update.docChanged || update.viewportChanged || update.startState.tree !== update.state.tree)
          this.decorations = build(update.view);
        if (
          (update.selectionSet && update.transactions.some((transaction) => transaction.scrollIntoView)) ||
          update.focusChanged
        )
          revealCursor = true;
        if (update.docChanged || update.viewportChanged || update.geometryChanged || revealCursor) schedule();
      },
    }),
    { decorations: (value) => value.decorations },
  );
  const compartment = new Compartment();
  view.dispatch({ effects: StateEffect.appendConfig.of(compartment.of(plugin)) });
  const controller = {
    schedule,
    renderActions: null,
    toggle: () => wrapState.toggle(),
  };
  const unsubscribeWrap = wrapState.subscribe(() => {
    offsets.clear();
    schedule();
    view.requestMeasure();
  });
  schedule();
  const dispose = () => {
    unsubscribeWrap();
    view.dom.removeEventListener('pointerover', onHover);
    view.dom.removeEventListener('pointerout', onHover);
    view.dom.removeEventListener('focusin', schedule);
    view.dom.removeEventListener('focusout', schedule);
    view.contentDOM.removeEventListener('scroll', onScroll, true);
    view.contentDOM.removeEventListener('wheel', onWheel, true);
    view.scrollDOM.removeEventListener('scroll', schedule);
    for (const bar of scrollbars.values()) bar.remove();
    scrollbars.clear();
    scrollLimits.clear();
    scrollGeometryStyle.remove();
    if (frame !== null) cancelAnimationFrame(frame);
    for (const row of view.contentDOM.querySelectorAll('[data-mcx-reading-table]')) {
      row.scrollLeft = 0;
    }
    if (!view.destroyed) view.dispatch({ effects: compartment.reconfigure([]) });
    offsets.clear();
    resize.disconnect();
    measure.remove();
    layoutStyle.remove();
    delete view.dom.dataset.mcxReadingTableScope;
  };
  dispose.controller = controller;
  return dispose;
}
