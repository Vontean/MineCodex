// 修补原生 Preview 的链接装饰；源码、语法树与编辑器实例继续归 Codex。
export async function loadNativeMarkdownLinks() {
  const url = [...document.querySelectorAll('link[rel="modulepreload"]')]
    .map((n) => n.href)
    .find((u) => /\/text-file-editor-extensions-[^/]+\.js$/.test(u));
  if (!url) throw new Error('native-markdown-link-module-unavailable');
  const source = await (await fetch(url)).text();
  const opener = source.match(/([\w$]+)\(\{event:[\w$]+,href:[\w$]+,initiator:`markdown_link_click`/)?.[1];
  let openHref;
  for (const match of source.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g))
    for (const entry of match[1].split(',')) {
      const parts = entry.trim().split(/\s+as\s+/);
      if (parts.at(-1) === opener) openHref = (await import(new URL(match[2], url).href))[parts[0]];
    }
  if (typeof openHref !== 'function') throw new Error('native-markdown-link-opener-unavailable');
  return openHref;
}

export function installMarkdownLinks(view, api, openHref) {
  const { Decoration, ViewPlugin, StateEffect, Compartment, WidgetType, Prec } = api;
  const normalize = (s) =>
    s
      .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const unescape = (s) => {
    const node = document.createElement('textarea');
    node.innerHTML = s;
    return node.value.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, '$1');
  };
  class Link extends WidgetType {
    constructor(label, href, title, format = []) {
      super();
      Object.assign(this, { label, href, title, format });
    }
    eq(other) {
      return (
        this.label === other.label &&
        this.href === other.href &&
        this.title === other.title &&
        JSON.stringify(this.format) === JSON.stringify(other.format)
      );
    }
    toDOM() {
      const span = document.createElement('span');
      span.className = 'mcx-reading-link';
      const append = (parent, parts) => {
        for (const part of parts) {
          if (typeof part === 'string') parent.append(document.createTextNode(part));
          else {
            const el = document.createElement(part.tag);
            append(el, part.children);
            parent.append(el);
          }
        }
      };
      if (this.format.length) append(span, this.format);
      else span.textContent = this.label;
      span.setAttribute('role', 'link');
      span.tabIndex = 0;
      if (this.title) span.title = this.title;
      span.dataset.href = this.href;
      const activate = (event) => {
        // 普通本地链接仍交给原生编辑器的文件打开回调。
        if (!/^(?:https?:|mailto:)/i.test(this.href)) return;
        event.preventDefault();
        event.stopPropagation();
        openHref({ event, href: this.href, initiator: 'markdown_link_click' });
      };
      span.addEventListener('click', (event) => {
        if (event.button === 0 && !event.shiftKey && event.detail === 1) activate(event);
      });
      span.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') activate(event);
      });
      return span;
    }
    ignoreEvent() {
      return false;
    }
  }
  class AutoLinks extends WidgetType {
    constructor(parts) {
      super();
      this.parts = parts;
    }
    eq(other) {
      return JSON.stringify(this.parts) === JSON.stringify(other.parts);
    }
    toDOM() {
      const span = document.createElement('span');
      for (const part of this.parts)
        span.append(
          part.href ? new Link(part.label, part.href, '').toDOM() : document.createTextNode(part.label),
        );
      return span;
    }
    ignoreEvent() {
      return false;
    }
  }
  let cachedTree,
    cachedDoc,
    references = new Map(),
    definitions = [];
  function build(editor) {
    const text = (node) => editor.state.sliceDoc(node.from, node.to);
    if (cachedTree !== editor.state.tree || cachedDoc !== editor.state.doc) {
      cachedTree = editor.state.tree;
      cachedDoc = editor.state.doc;
      references = new Map();
      definitions = [];
      editor.state.tree.iterate({
        enter(n) {
          if (n.name !== 'LinkReference') return;
          const node = n.node,
            label = node.getChild('LinkLabel'),
            url = node.getChild('URL'),
            title = node.getChild('LinkTitle');
          if (label && url) {
            const key = normalize(text(label).slice(1, -1));
            // 原生把脚注也解析成 LinkReference；保留脚注源码，不能隐藏正文。
            if (key.startsWith('^')) return false;
            if (!references.has(key))
              references.set(key, {
                href: unescape(text(url).replace(/^<|>$/g, '')),
                title: title ? unescape(text(title).slice(1, -1)) : '',
              });
            definitions.push(node);
          }
          return false;
        },
      });
    }
    const ranges = [];
    const selected = (node) =>
      editor.hasFocus &&
      editor.state.selection.ranges.some((r) =>
        r.empty ? r.from >= node.from && r.from <= node.to : r.from < node.to && r.to > node.from,
      );
    for (const node of definitions) {
      if (selected(node)) continue;
      for (
        let number = editor.state.doc.lineAt(node.from).number;
        number <= editor.state.doc.lineAt(node.to).number;
        number++
      ) {
        const line = editor.state.doc.line(number);
        if (line.to < editor.viewport.from || line.from > editor.viewport.to) continue;
        ranges.push(Decoration.line({ class: 'mcx-reading-link-definition' }).range(line.from));
        if (line.to > line.from) ranges.push(Decoration.replace({}).range(line.from, line.to));
      }
    }
    editor.state.tree.iterate({
      from: editor.viewport.from,
      to: editor.viewport.to,
      enter(n) {
        if (n.name === 'LinkReference') return false;
        if (n.name === 'URL' && n.node.parent?.name === 'Paragraph') {
          const raw = text(n.node),
            parts = [];
          let cursor = 0;
          for (const match of raw.matchAll(/(?:https?:\/\/|www\.)[^\s<>、，。；！？]+/gi)) {
            const label = match[0].replace(/[.,;:!?]+$/g, '');
            if (!label) continue;
            if (match.index > cursor) parts.push({ label: raw.slice(cursor, match.index) });
            parts.push({ label, href: label.startsWith('www.') ? `https://${label}` : unescape(label) });
            cursor = match.index + label.length;
          }
          if (cursor < raw.length) parts.push({ label: raw.slice(cursor) });
          if (parts.some((part) => part.href))
            ranges.push(Decoration.replace({ widget: new AutoLinks(parts) }).range(n.from, n.to));
          return false;
        }
        if (n.name !== 'Link') return;
        const node = n.node;
        if (
          (selected(node) && !editor.state.selection.main.empty) ||
          editor.state.doc.lineAt(node.from).number !== editor.state.doc.lineAt(node.to).number
        )
          return false;
        const marks = node.getChildren('LinkMark'),
          start = marks[0],
          end = marks.find((m) => text(m) === ']');
        if (!start || !end) return false;
        const labelFrom = start.to,
          labelTo = end.from;
        const urls = node.getChildren('URL'),
          url = urls.find((u) => u.from > labelTo),
          title = node.getChild('LinkTitle'),
          reference = node.getChild('LinkLabel');
        if (url && !title && !urls.some((u) => u.from >= labelFrom && u.to <= labelTo)) return false;
        const key = normalize(
          reference
            ? text(reference).slice(1, -1) || editor.state.sliceDoc(labelFrom, labelTo)
            : editor.state.sliceDoc(labelFrom, labelTo),
        );
        const target = url
          ? {
              href: unescape(text(url).replace(/^<|>$/g, '')),
              title: title ? unescape(text(title).slice(1, -1)) : '',
            }
          : references.get(key);
        if (!target || /^(?:javascript|data|vbscript):/i.test(target.href)) return false;
        const omit = [];
        node.toTree().iterate({
          enter(child) {
            if (/^(EmphasisMark|CodeMark|StrikethroughMark)$/.test(child.name)) {
              const from = node.from + child.from,
                to = node.from + child.to;
              if (from >= labelFrom && to <= labelTo) omit.push([from, to]);
            }
          },
        });
        let label = '',
          cursor = labelFrom;
        for (const [from, to] of omit.sort((a, b) => a[0] - b[0])) {
          label += editor.state.sliceDoc(cursor, from);
          cursor = to;
        }
        label = unescape(label + editor.state.sliceDoc(cursor, labelTo));
        const format = (node) => {
          const parts = [];
          let cursor = Math.max(node.from, labelFrom);
          for (let child = node.firstChild; child; child = child.nextSibling) {
            if (child.to <= labelFrom || child.from >= labelTo) continue;
            if (child.from > cursor) parts.push(unescape(editor.state.sliceDoc(cursor, child.from)));
            const tag = {
              StrongEmphasis: 'strong',
              Emphasis: 'em',
              Strikethrough: 'del',
              InlineCode: 'code',
            }[child.name];
            if (tag) parts.push({ tag, children: format(child) });
            else if (!/^(?:LinkMark|EmphasisMark|CodeMark|StrikethroughMark)$/.test(child.name))
              parts.push(
                unescape(editor.state.sliceDoc(Math.max(child.from, labelFrom), Math.min(child.to, labelTo))),
              );
            cursor = Math.min(child.to, labelTo);
          }
          if (cursor < Math.min(node.to, labelTo))
            parts.push(unescape(editor.state.sliceDoc(cursor, Math.min(node.to, labelTo))));
          return parts;
        };
        ranges.push(
          Decoration.replace({ widget: new Link(label, target.href, target.title, format(node)) }).range(
            node.from,
            node.to,
          ),
        );
        return false;
      },
    });
    return Decoration.set(ranges, true);
  }
  const plugin = ViewPlugin.define(
    (editor) => ({
      decorations: build(editor),
      update(update) {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.focusChanged ||
          update.viewportChanged ||
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
