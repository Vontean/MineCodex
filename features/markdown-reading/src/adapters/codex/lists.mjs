export function installMarkdownLists(view, api) {
  const { Decoration, ViewPlugin, StateEffect, Compartment, WidgetType, Prec } = api;
  class Marker extends WidgetType {
    constructor(kind, label) {
      super();
      this.kind = kind;
      this.label = label;
    }
    eq(other) {
      return this.kind === other.kind && this.label === other.label;
    }
    toDOM() {
      const span = document.createElement('span');
      span.className = `mcx-reading-list-marker mcx-reading-${this.kind}`;
      if (this.kind.startsWith('task')) {
        span.setAttribute('role', 'img');
        span.setAttribute('aria-label', this.kind === 'task-checked' ? '已完成' : '未完成');
        span.append(document.createElement('span'));
      } else {
        span.textContent = this.label;
        span.setAttribute('aria-hidden', 'true');
      }
      return span;
    }
    ignoreEvent() {
      return false;
    }
  }
  function build(editor) {
    const tree = editor.state.tree;
    if (!tree) return Decoration.none;
    const rows = new Map();
    tree.iterate({
      from: editor.viewport.from,
      to: editor.viewport.to,
      enter(node) {
        if (node.name !== 'ListItem') return;
        const item = node.node;
        const mark = item.getChild('ListMark');
        if (!mark) return;
        let depth = 0;
        for (let parent = item.parent; parent; parent = parent.parent)
          if (parent.name === 'ListItem') depth++;
        const first = editor.state.doc.lineAt(item.from);
        const last = editor.state.doc.lineAt(item.to);
        const task = item.getChild('Task')?.getChild('TaskMarker');
        let end = task?.to ?? mark.to;
        while (/[\t ]/.test(editor.state.sliceDoc(end, end + 1))) end++;
        const prefix = editor.state.sliceDoc(first.from, mark.from);
        if (!/^[\t >]*$/.test(prefix)) return;
        const quoteDepth = (prefix.match(/>/g) || []).length;
        const raw = editor.state.sliceDoc(mark.from, mark.to);
        const kind = task
          ? /x/i.test(editor.state.sliceDoc(task.from, task.to))
            ? 'task-checked'
            : 'task-empty'
          : item.parent.name === 'OrderedList'
            ? 'ordered'
            : ['disc', 'circle', 'square'][Math.min(depth, 2)];
        for (let number = first.number; number <= last.number; number++) {
          const line = editor.state.doc.line(number);
          if (line.to < editor.viewport.from || line.from > editor.viewport.to) continue;
          let syntax = tree.resolveInner(line.from + (line.text.match(/^[\t ]*/)?.[0].length ?? 0), 1);
          let block = false;
          for (; syntax; syntax = syntax.parent)
            if (['CodeBlock', 'FencedCode', 'Table', 'MathBlock', 'HTMLBlock'].includes(syntax.name))
              block = true;
          if (block) continue;
          const current = rows.get(line.from);
          if (!current || current.depth <= depth)
            rows.set(line.from, {
              line,
              depth,
              quoteDepth,
              kind,
              raw,
              end,
              first: number === first.number,
              done: kind === 'task-checked' && line.from < (item.getChild('Task')?.to ?? 0),
              trim: mark.to - first.from + 1,
            });
        }
      },
    });
    const ranges = [];
    for (const row of rows.values()) {
      const { line, depth, kind, raw, end, first, done, trim, quoteDepth } = row;
      // 光标进入标记时显示源码，编辑和选区继续由原生负责。
      if (
        first &&
        view.hasFocus &&
        view.state.selection.ranges.some((range) => range.from <= end && range.to >= line.from)
      )
        continue;
      const markerWidth = kind === 'ordered' ? Math.max(1.75, raw.length * 0.65 + 0.5) : 1.75;
      ranges.push(
        Decoration.line({
          class: `mcx-reading-list-row${first ? ' mcx-reading-list-first' : ''}${done ? ' mcx-reading-task-done' : ''}`,
          attributes: {
            style: `--mcx-list-indent:calc(${depth * 1.75}em + ${quoteDepth * 20}px);--mcx-list-marker-width:${markerWidth}em`,
          },
        }).range(line.from),
      );
      if (first)
        ranges.push(
          Decoration.replace({ widget: new Marker(kind, kind === 'ordered' ? raw : '') }).range(
            line.from,
            end,
          ),
        );
      else {
        const spaces = line.text.match(/^[\t ]+/)?.[0];
        if (spaces)
          ranges.push(Decoration.replace({}).range(line.from, line.from + Math.min(spaces.length, trim)));
      }
    }
    return Decoration.set(ranges, true);
  }
  const plugin = ViewPlugin.define(
    (editor) => ({
      decorations: build(editor),
      update(update) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.focusChanged ||
          update.startState.tree !== update.state.tree
        )
          this.decorations = build(update.view);
      },
    }),
    { decorations: (value) => value.decorations },
  );
  const compartment = new Compartment();
  view.dispatch({
    effects: StateEffect.appendConfig.of(compartment.of(Prec ? Prec.highest(plugin) : plugin)),
  });
  return () => {
    if (!view.destroyed) view.dispatch({ effects: compartment.reconfigure([]) });
  };
}
