import { collectMarkdownFootnotes } from '../../domain/footnotes.mjs';
import { captureMarkdownProviders } from './providers.mjs';

// 复用消息流的代码组件与 Markdown lexer；文件内容及编辑器仍由 Codex 持有。
export async function loadNativeMarkdownRichText(native) {
  const links = [...document.querySelectorAll('link[rel="modulepreload"]')].map((n) => n.href);
  const { sharedUrl } = native;
  const sharedSource = await (await fetch(sharedUrl)).text(),
    shared = await import(sharedUrl);
  const codeAt = sharedSource.indexOf('id:`codeSnippet.wrap.disable`');
  const codeSection = sharedSource.slice(
    sharedSource.lastIndexOf('function ', codeAt),
    sharedSource.indexOf('function ', codeAt),
  );
  const codeName = codeSection.match(/^function ([\w$]+)/)?.[1];
  const sharedExports = sharedSource.slice(sharedSource.lastIndexOf('export{'));
  const sharedBinding = (name) =>
    shared[sharedExports.match(new RegExp(`${name.replace(/\$/g, '\\$')} as ([\\w$]+)`))?.[1]];
  const cacheName = codeSection.match(/let t=\(0,([\w$]+)\.c\)/)?.[1];
  const assignment = sharedSource.indexOf(`${cacheName}=`); // 从组件依赖找到其 lazy initializer。
  const codeInit = sharedSource
    .slice(sharedSource.lastIndexOf('function ', assignment))
    .match(/^function ([\w$]+)/)?.[1];
  if (!codeInit || !sharedBinding(codeInit) || !sharedBinding(codeName))
    throw new Error('native-code-snippet-unavailable');
  sharedBinding(codeInit)();
  let mathUrl = links.find((u) => /\/katex-[^/]+\.js$/.test(u));
  if (!mathUrl) {
    const editorUrl = links.find((u) => /\/text-file-editor-extensions-[^/]+\.js$/.test(u));
    if (editorUrl) {
      const editorSource = await (await fetch(editorUrl)).text(),
        specifier = editorSource.match(/import\(`(\.\/katex-[^`]+\.js)`\)/)?.[1];
      if (specifier) mathUrl = new URL(specifier, editorUrl).href;
    }
  }
  const katex = mathUrl ? (await import(mathUrl)).default : null;
  if (!katex?.renderToString) throw new Error('native-katex-unavailable');
  return { ...native, CodeSnippet: sharedBinding(codeName), katex };
}

export function installMarkdownRichText(view, api, native, codex) {
  const { Decoration, StateField, StateEffect, Compartment, WidgetType, Prec } = api;
  const {
    React,
    ReactDOM,
    Markdown,
    lexer,
    CodeSnippet,
    Actions,
    Button,
    CopyButton,
    Tooltip,
    wrapIcons,
    katex,
  } = native;
  const h = React.createElement,
    roots = new Set(),
    footnoteReturns = new Map(),
    codeStates = new Map();
  const withProviders = captureMarkdownProviders(view.dom, codex);
  const mount = (element, tree) => {
    const root = ReactDOM.createRoot(element);
    roots.add(root);
    root.render(withProviders(React, tree));
    return root;
  };
  function Code({ content, language, id }) {
    const [wrap, setWrap] = React.useState(
        () => (codeStates.get(id)?.source === content && codeStates.get(id).wrap) || false,
      ),
      [overflow, setOverflow] = React.useState(false),
      ref = React.useRef(null);
    React.useLayoutEffect(() => {
      const element = ref.current?.querySelector('code')?.parentElement;
      if (!element) return;
      const check = () => {
        setOverflow(element.scrollWidth > element.clientWidth + 1);
        view.requestMeasure();
      };
      const observer = new ResizeObserver(check);
      observer.observe(element);
      const code = element.querySelector('code');
      if (code) observer.observe(code);
      check();
      return () => observer.disconnect();
    }, [wrap, content]);
    const label = wrap ? '关闭代码换行' : '开启代码换行';
    return h(
      'div',
      { ref, className: 'mcx-reading-code-block group/app-widget' },
      h(CodeSnippet, {
        content,
        language,
        renderSvgAsImage: false,
        showCopyButton: false,
        showStickyRightContent: false,
        shouldWrapCode: wrap,
        stickyHeader: false,
        codeContainerClassName: 'mcx-reading-code-scroll',
      }),
      h(
        Actions,
        { 'data-markdown-copy': 'exclude', className: 'bg-transparent' },
        wrap || overflow
          ? h(
              Tooltip,
              { tooltipContent: label, delayOpen: true },
              h(
                Button,
                {
                  'aria-label': label,
                  color: 'blockAction',
                  radius: 'full',
                  size: 'inputIcon',
                  onClick: () => {
                    codeStates.set(id, { source: content, wrap: !wrap });
                    setWrap(!wrap);
                  },
                },
                h(wrap ? wrapIcons.disable : wrapIcons.enable),
              ),
            )
          : null,
        h(CopyButton, {
          ariaLabel: '复制代码',
          buttonText: '复制代码',
          iconOnly: true,
          variant: 'blockAction',
          onCopy: () => navigator.clipboard.writeText(content).then(() => true),
        }),
      ),
    );
  }
  class Rich extends WidgetType {
    constructor(kind, source, options = {}) {
      super();
      Object.assign(this, { kind, source, options });
    }
    eq(other) {
      return (
        this.kind === other.kind &&
        this.source === other.source &&
        JSON.stringify(this.options) === JSON.stringify(other.options)
      );
    }
    get estimatedHeight() {
      return this.kind === 'code' ? 92 + this.source.split('\n').length * 20 : -1;
    }
    toDOM() {
      const element = document.createElement(
        this.kind === 'code' || this.kind === 'html-block' ? 'div' : 'span',
      );
      element.className = `mcx-reading-rich mcx-reading-rich-${this.kind}`;
      if (this.options.quoteDepth) {
        element.style.paddingInlineStart = `${this.options.quoteDepth * 20}px`;
        element.classList.add('mcx-reading-rich-quoted');
      }
      if (this.kind === 'text') element.textContent = this.source;
      else if (this.kind === 'code')
        element._mcxRoot = mount(
          element,
          h(Code, { content: this.source, language: this.options.language, id: this.options.from }),
        );
      else if (this.kind === 'math')
        element.innerHTML = katex.renderToString(this.source, {
          displayMode: false,
          strict: 'ignore',
          throwOnError: false,
        });
      else if (this.kind === 'footnote-ref') {
        const sup = document.createElement('sup'),
          button = document.createElement('button');
        button.textContent = this.options.number;
        button.type = 'button';
        button.setAttribute('aria-label', `脚注 ${this.options.number}`);
        button.dataset.mcxFootnoteRef = this.options.id;
        button.addEventListener('click', (event) => {
          event.preventDefault();
          // 虚拟段落重新测量后像素高度会变化，使用原生文档锚点恢复阅读位置。
          footnoteReturns.set(this.options.id, view.scrollSnapshot());
          jump(this.options.to);
        });
        sup.append(button);
        element.append(sup);
      } else if (this.kind === 'footnote-body') {
        element.classList.add('mcx-reading-footnote-body');
        const number = document.createElement('span');
        number.textContent = `${this.options.number}. `;
        element.append(number);
        const body = document.createElement('span');
        body.className = 'mcx-reading-footnote-content';
        element.append(body);
        element._mcxRoot = mount(
          body,
          h(Markdown, { tokens: lexer(this.source, undefined), components: { p: React.Fragment } }),
        );
        const back = document.createElement('button');
        back.type = 'button';
        back.textContent = '↩';
        back.setAttribute('aria-label', '返回脚注引用');
        back.addEventListener('click', () => {
          const previous = footnoteReturns.get(this.options.id);
          if (previous === undefined) jump(this.options.to);
          else {
            view.dispatch({ effects: previous });
          }
        });
        element.append(back);
      } else if (this.kind === 'html' || this.kind === 'html-block') {
        const parsed = new DOMParser().parseFromString(this.source, 'text/html');
        const allowed = new Set([
          'P',
          'DIV',
          'SPAN',
          'BR',
          'MARK',
          'KBD',
          'STRONG',
          'B',
          'EM',
          'I',
          'S',
          'DEL',
          'U',
          'SUB',
          'SUP',
          'SMALL',
          'BLOCKQUOTE',
          'UL',
          'OL',
          'LI',
          'DL',
          'DT',
          'DD',
          'PRE',
          'CODE',
          'H1',
          'H2',
          'H3',
          'H4',
          'H5',
          'H6',
          'HR',
          'TABLE',
          'THEAD',
          'TBODY',
          'TR',
          'TD',
          'TH',
          'A',
          'DETAILS',
          'SUMMARY',
        ]);
        const clean = (node) => {
          if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
          if (
            node.nodeType !== Node.ELEMENT_NODE ||
            ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH'].includes(node.tagName)
          )
            return document.createDocumentFragment();
          const el = allowed.has(node.tagName)
            ? document.createElement(node.tagName.toLowerCase())
            : document.createDocumentFragment();
          if (el.nodeType === Node.ELEMENT_NODE) {
            for (const name of ['title', 'colspan', 'rowspan', 'start', 'open'])
              if (node.hasAttribute(name)) el.setAttribute(name, node.getAttribute(name));
            if (node.tagName === 'A') {
              const href = node.getAttribute('href') || '';
              if (/^(?:javascript|data|vbscript):/i.test(href))
                return document.createTextNode(node.textContent);
              const link = document.createElement('span');
              const root = mount(
                link,
                h(Markdown, {
                  tokens: lexer(`[${node.textContent.replace(/([\\\[\]])/g, '\\$1')}](${href})`, undefined),
                  components: { p: React.Fragment },
                }),
              );
              element._mcxChildRoots ??= [];
              element._mcxChildRoots.push(root);
              return link;
            }
          }
          for (const child of node.childNodes) el.append(clean(child));
          return el;
        };
        for (const child of parsed.body.childNodes) element.append(clean(child));
      }
      requestAnimationFrame(() => {
        if (!view.destroyed) view.requestMeasure();
      });
      return element;
    }
    destroy(element) {
      for (const root of element._mcxChildRoots || []) {
        roots.delete(root);
        root.unmount();
      }
      if (element._mcxRoot) {
        roots.delete(element._mcxRoot);
        element._mcxRoot.unmount();
      }
    }
    ignoreEvent() {
      return true;
    }
  }
  function jump(pos) {
    view.dispatch({ effects: view.constructor.scrollIntoView(pos, { y: 'start', yMargin: 24 }) });
    view.requestMeasure();
  }
  function build(state) {
    const ranges = [],
      doc = state.doc,
      text = doc.toString(),
      tree = state.tree;
    if (!tree) return Decoration.none;
    const selected = (from, to) =>
      view.hasFocus && state.selection.ranges.some((r) => !r.empty && r.from < to && r.to > from);
    const hiddenLines = new Set(),
      quotes = new Map(),
      alerts = new Map(),
      protectedRanges = [];
    tree.iterate({
      enter(n) {
        if (
          [
            'FencedCode',
            'CodeBlock',
            'InlineCode',
            'HTMLBlock',
            'HTMLTag',
            'CommentBlock',
            'Comment',
          ].includes(n.name)
        )
          protectedRanges.push([n.from, n.to]);
      },
    });
    const protectedAt = (pos) => protectedRanges.some(([from, to]) => pos >= from && pos < to);
    const replace = (from, to, widget, block = false) => {
      if (to > from && !selected(from, to))
        ranges.push(Decoration.replace({ widget, block }).range(from, to));
    };
    tree.iterate({
      enter(n) {
        const node = n.node,
          raw = state.sliceDoc(n.from, n.to),
          line = doc.lineAt(n.from);
        if (
          n.name === 'MathInline' &&
          raw.startsWith('\\[') &&
          doc.lineAt(n.from).number === doc.lineAt(n.to).number
        ) {
          replace(n.from, n.to, new Rich('text', `[${raw.slice(2, -2)}]`));
          return false;
        }
        if (n.name === 'Escape') {
          replace(n.from, n.from + 1);
          return false;
        }
        if (n.name === 'HardBreak') {
          if (raw.startsWith('\\')) replace(n.from, n.from + 1);
          return false;
        }
        if (n.name === 'HeaderMark' && node.parent?.name.startsWith('SetextHeading')) {
          hiddenLines.add(line.from);
          return false;
        }
        if (n.name === 'Blockquote') {
          let depth = 0;
          for (let parent = node; parent; parent = parent.parent) if (parent.name === 'Blockquote') depth++;
          const last = doc.lineAt(n.to),
            callout = raw.split('\n', 1)[0].match(/^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/);
          for (let i = line.number; i <= last.number; i++) {
            const l = doc.line(i);
            quotes.set(l.from, Math.max(quotes.get(l.from) || 0, depth));
            if (callout)
              alerts.set(
                l.from,
                `${i === line.number ? ' mcx-reading-callout-first' : ''}${i === last.number ? ' mcx-reading-callout-last' : ''}`,
              );
          }
        }
        if (n.name === 'FencedCode' || n.name === 'CodeBlock') {
          const language = node.getChild('CodeInfo')
            ? state.sliceDoc(node.getChild('CodeInfo').from, node.getChild('CodeInfo').to).split(/\s/)[0]
            : undefined;
          if (['mermaid', 'math', 'latex', 'tex'].includes(language)) return false;
          const first = doc.lineAt(n.from),
            last = doc.lineAt(n.to),
            fenced = n.name === 'FencedCode',
            marks = node.getChildren('CodeMark');
          const from = first.from,
            to = last.to,
            closed = fenced && marks.length === 2;
          let quoteDepth = 0;
          for (let parent = node.parent; parent; parent = parent.parent)
            if (parent.name === 'Blockquote') quoteDepth++;
          const unquote = (line) => {
            for (let i = 0; i < quoteDepth; i++) line = line.replace(/^[ \t]*>[ \t]?/, '');
            return line;
          };
          const prefixWidth = first.text.length - unquote(first.text).length;
          const sourceIndent = Math.max(
            0,
            (fenced ? (marks[0]?.from ?? n.from) : n.from) - first.from - prefixWidth,
          );
          const lines = [];
          for (let i = first.number + (fenced ? 1 : 0); i <= last.number - (closed ? 1 : 0); i++) {
            const line = unquote(doc.line(i).text);
            lines.push(
              line.startsWith('\t') && !fenced
                ? line.slice(1)
                : line.replace(new RegExp(`^ {0,${sourceIndent}}`), ''),
            );
          }
          replace(from, to, new Rich('code', lines.join('\n'), { language, quoteDepth, from }), true);
          return false;
        }
        if (n.name === 'Comment' || n.name === 'CommentBlock') {
          replace(n.from, n.to);
          if (line.from === n.from && doc.lineAt(n.to).to === n.to) hiddenLines.add(line.from);
          return false;
        }
        if (n.name === 'HTMLBlock') {
          replace(line.from, doc.lineAt(n.to).to, new Rich('html-block', raw), true);
          return false;
        }
        if (n.name === 'HTMLTag') {
          const opening = raw.match(/^<([a-z][\w-]*)\b[^>]*>$/i);
          if (opening && !/\/\s*>$/.test(raw) && !['br', 'hr'].includes(opening[1].toLowerCase())) {
            const rest = text.slice(n.to, doc.lineAt(n.to).to),
              closing = new RegExp(`</${opening[1]}\\s*>`, 'i').exec(rest);
            if (closing) {
              const to = n.to + closing.index + closing[0].length;
              replace(n.from, to, new Rich('html', text.slice(n.from, to)));
              return false;
            }
          }
          if (/^<(br|hr)\s*\/?\s*>$/i.test(raw)) replace(n.from, n.to, new Rich('html', raw));
          return false;
        }
      },
    });
    for (const [from, depth] of quotes) {
      const line = doc.lineAt(from),
        prefix = line.text.match(/^(?:[ \t]*>[ \t]?)+/);
      ranges.push(
        Decoration.line({
          class: `mcx-reading-quote${alerts.has(from) ? ' mcx-reading-callout' + alerts.get(from) : ''}`,
          attributes: { style: `--mcx-quote-indent:${depth * 20}px` },
        }).range(from),
      );
      if (prefix && !/^(?:[-+*]|\d+[.)])\s/.test(line.text.slice(prefix[0].length)))
        replace(from, from + prefix[0].length);
      const alert = line.text
        .slice(prefix?.[0].length || 0)
        .match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/);
      if (alert) {
        ranges.push(Decoration.line({ class: 'mcx-reading-alert-title' }).range(from));
        replace(
          from + (prefix?.[0].length || 0),
          line.to,
          new (class extends WidgetType {
            toDOM() {
              const span = document.createElement('span');
              span.textContent = {
                NOTE: '提示',
                TIP: '建议',
                IMPORTANT: '重要',
                WARNING: '警告',
                CAUTION: '注意',
              }[alert[1]];
              return span;
            }
          })(),
        );
      }
    }
    const { definitions: footnotes, references, definitionRanges } = collectMarkdownFootnotes(text, protectedRanges);
    // 同名定义沿用最后一条；早期定义不再被误作引用或普通正文。
    for (const note of definitionRanges) {
      if (footnotes.get(note.id).from === note.from) continue;
      replace(note.from, note.to);
      for (let i = doc.lineAt(note.from).number; i <= doc.lineAt(note.to).number; i++)
        hiddenLines.add(doc.line(i).from);
    }
    for (const reference of references)
      replace(
        reference.from,
        reference.to,
        new Rich('footnote-ref', '', {
          id: reference.id,
          number: reference.number,
          to: reference.definitionFrom,
        }),
      );
    for (const [id, note] of footnotes)
      replace(
        note.from,
        note.to,
        new Rich('footnote-body', note.body, {
          id,
          number: note.number,
          to: note.refs[0] ?? note.from,
        }),
        note.from !== doc.lineAt(note.to).from,
      );
    // 单美元公式与定义列表只处理普通正文，跳过代码、HTML 和脚注定义。
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      if (
        protectedAt(line.from) ||
        definitionRanges.some((n) => line.from >= n.from && line.from <= n.to)
      )
        continue;
      for (const m of line.text.matchAll(/(?<![\\$])\$(?![\s$])([^$\n]+?)(?<![\s\\])\$(?!\$)/g)) {
        const from = line.from + m.index;
        if (!protectedAt(from)) replace(from, from + m[0].length, new Rich('math', m[1]));
      }
      if (/^: +\S/.test(line.text) && i > 1) {
        const term = doc.line(i - 1);
        if (term.text.trim() && !/^: +/.test(term.text))
          ranges.push(Decoration.line({ class: 'mcx-reading-definition-term' }).range(term.from));
        ranges.push(Decoration.line({ class: 'mcx-reading-definition-body' }).range(line.from));
        replace(line.from, line.from + line.text.match(/^: +/)[0].length);
      }
    }
    for (const from of hiddenLines)
      if (!selected(from, doc.lineAt(from).to))
        ranges.push(Decoration.line({ class: 'mcx-reading-syntax-line' }).range(from));
    // HTML 成对标签和块替换覆盖内部装饰；只保留最外层 replacement。
    const replacements = ranges
        .filter((r) => r.value.isReplace)
        .sort((a, b) => a.from - b.from || b.to - a.to),
      accepted = [];
    for (const r of replacements) if (!accepted.some((a) => r.from < a.to && r.to > a.from)) accepted.push(r);
    return Decoration.set(
      [
        ...ranges.filter(
          (r) =>
            !r.value.isReplace && !accepted.some((a) => a.value.block && r.from >= a.from && r.from < a.to),
        ),
        ...accepted,
      ],
      true,
    );
  }
  const field = StateField.define({
    create: build,
    update(value, transaction) {
      return transaction.docChanged ||
        transaction.selection ||
        transaction.startState.tree !== transaction.state.tree
        ? build(transaction.state)
        : value;
    },
    provide: (field) => view.constructor.decorations.from(field),
  });
  const compartment = new Compartment();
  view.dispatch({ effects: StateEffect.appendConfig.of(compartment.of(Prec.highest(field))) });
  return () => {
    if (!view.destroyed) view.dispatch({ effects: compartment.reconfigure([]) });
    for (const root of roots) root.unmount();
    roots.clear();
  };
}
