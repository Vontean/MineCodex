import { loadNativeMarkdownRenderer } from './markdown-native.mjs';
import { captureMarkdownProviders } from './providers.mjs';

export function markdownExportAlias(source, name) {
  const start = source.lastIndexOf('export{');
  if (start < 0) return undefined;
  const entries = source.slice(start + 7).split('}')[0].split(',');
  for (const entry of entries) {
    const [local, alias = local] = entry.trim().split(/\s+as\s+/);
    if (local === name) return alias;
  }
  return undefined;
}

// 从 Chat Markdown 的公开组件发现悬浮操作栏和控件，不绑定构建 hash。
export async function loadNativeMarkdownTableActions(native) {
  const url = [...document.querySelectorAll('link[rel="modulepreload"],script[src]')]
    .map((n) => n.href || n.src)
    .find((url) => /\/app-initial-[^/]+\.js/.test(url));
  const response = await fetch(url);
  if (!response.ok) throw new Error('native-table-actions-source-unavailable');
  const source = await response.text();
  const section = (marker) => {
    const at = source.indexOf(marker),
      start = source.lastIndexOf('function ', at),
      end = source.indexOf('function ', at);
    if (at < 0 || start < 0 || end < 0) throw new Error('native-table-actions-contract-changed');
    return source.slice(start, end);
  };
  const actions = section('"data-block-actions":!0'),
    table = section('id:`markdown.expandTable`');
  const exported = source.slice(source.lastIndexOf('export{'));
  const module = await import(url);
  const publicBinding = (name) => {
    const alias = markdownExportAlias(exported, name);
    if (!alias || !module[alias]) throw new Error('native-table-actions-export-unavailable');
    return module[alias];
  };
  // 初始化原生 lazy module，再使用其公开 React 组件。
  const initializer = source
    .slice(source.indexOf(table) + table.length)
    .match(/^function ([\w$]+)\(\)\{return\(\1=/)?.[1];
  if (!initializer) throw new Error('native-table-actions-initializer-unavailable');
  publicBinding(initializer)();
  const imports = new Map();
  for (const match of source.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g))
    for (const entry of match[1].split(',')) {
      const parts = entry.trim().split(/\s+as\s+/);
      imports.set(parts.at(-1), { name: parts[0], url: new URL(match[2], url).href });
    }
  const binding = async (name) => {
    const item = imports.get(name);
    if (!item) throw new Error('native-table-actions-dependency-unavailable');
    return (await import(item.url))[item.name];
  };
  const sharedUrl = [...imports.values()].find((item) => /\/app-shared-[^/]+\.js/.test(item.url))?.url;
  if (!sharedUrl) throw new Error('native-code-wrap-module-unavailable');
  const sharedSource = await (await fetch(sharedUrl)).text(),
    shared = await import(sharedUrl);
  const wrapAt = sharedSource.indexOf('id:`codeSnippet.wrap.disable`');
  const wrapSection = sharedSource.slice(
    sharedSource.lastIndexOf('function ', wrapAt),
    sharedSource.indexOf('function ', wrapAt),
  );
  const wrapPair = wrapSection.match(
    /children:[\w$]+\?\(0,[\w$]+\.jsx\)\(([\w$]+),\{\}\):\(0,[\w$]+\.jsx\)\(([\w$]+),\{\}\)/,
  );
  if (wrapAt < 0 || !wrapPair) throw new Error('native-code-wrap-icons-unavailable');
  const sharedExports = sharedSource.slice(sharedSource.lastIndexOf('export{'));
  const sharedBinding = (name) => shared[markdownExportAlias(sharedExports, name)];
  const assignment = sharedSource.indexOf(`${wrapPair[1]}=`);
  const initialize = sharedSource
    .slice(sharedSource.lastIndexOf('function ', assignment))
    .match(/^function ([\w$]+)\(\)/)?.[1];
  if (initialize && typeof sharedBinding(initialize) === 'function') sharedBinding(initialize)();
  const wrapIcons = { disable: sharedBinding(wrapPair[1]), enable: sharedBinding(wrapPair[2]) };
  if (!wrapIcons.disable || !wrapIcons.enable) throw new Error('native-code-wrap-icon-exports-unavailable');
  const button = table.match(/jsx\)\(([\w$]+),\{"aria-label":[\w$]+,"aria-expanded"/)?.[1];
  const copy = table.match(/jsx\)\(([\w$]+),\{ariaLabel:[\w$]+,buttonText:/)?.[1];
  const tooltip = table.match(/jsx\)\(([\w$]+),\{tooltipContent:[\w$]+,delayOpen:!0/)?.[1];
  if (!button || !copy || !tooltip) throw new Error('native-table-actions-controls-unavailable');
  const [Button, CopyButton, Tooltip] = await Promise.all([binding(button), binding(copy), binding(tooltip)]);
  const previewName = table.match(/jsx\)\(([\w$]+),\{src:``,alt:/)?.[1];
  const tableName = table.match(/jsx\)\(([\w$]+),\{className:[\w$]+,children:[\w$]+\}/)?.[1];
  const classesName = table.match(/([\w$]+)\.MarkdownTablePreview/)?.[1];
  const icon = table.match(/children:\(0,[\w$]+\.jsx\)\(([\w$]+),\{icon:\{16:([\w$]+),20:([\w$]+)\}\}\)/);
  if (!previewName || !tableName || !classesName || !icon)
    throw new Error('native-table-preview-contract-unavailable');
  const [Icon, small, medium, renderer] = await Promise.all([
    binding(icon[1]),
    binding(icon[2]),
    binding(icon[3]),
    loadNativeMarkdownRenderer(source, url, module),
  ]);
  return {
    ...native,
    ...renderer,
    TablePreview: publicBinding(previewName),
    Table: publicBinding(tableName),
    tableClasses: publicBinding(classesName),
    ExpandIcon: () => native.React.createElement(Icon, { icon: { 16: small, 20: medium } }),
    Actions: publicBinding(actions.match(/^function ([\w$]+)/)[1]),
    Button,
    wrapIcons,
    CopyButton,
    Tooltip,
  };
}

export function installMarkdownTableActions(view, native, codex, controller) {
  const {
    React,
    ReactDOM,
    Actions,
    Button,
    wrapIcons,
    CopyButton,
    Tooltip,
    TablePreview,
    Table,
    tableClasses,
    ExpandIcon,
    Markdown,
    lexer,
  } = native;
  const h = React.createElement;
  const mount = document.createElement('div');
  mount.dataset.mcxReadingTableActions = '';
  view.scrollDOM.append(mount);
  const withProviders = captureMarkdownProviders(view.dom, codex);
  const root = ReactDOM.createRoot(mount);
  const chinese = document.documentElement.lang.startsWith('zh');
  function TableActions({ item }) {
    const [open, setOpen] = React.useState(false);
    const trigger = React.useRef(null);
    const tokens = React.useMemo(() => (open ? lexer(item.source, undefined) : []), [open, item.source]);
    const wrap = chinese
      ? item.fit
        ? '关闭文档换行'
        : '开启文档换行'
      : item.fit
        ? 'Disable document word wrap'
        : 'Enable document word wrap';
    const copy = chinese ? '复制表格' : 'Copy table';
    const expand = chinese ? '展开表格' : 'Expand table';
    const preview = chinese ? '表格预览' : 'Table preview';
    const scroll = chinese ? '可横向滚动的表格' : 'Scrollable table';
    return h(
      React.Fragment,
      null,
      h(
        'div',
        {
          'data-mcx-reading-table-action-id': item.id,
          style: {
            position: 'absolute',
            left: item.left,
            top: item.top,
            width: item.width,
            height: 48,
            pointerEvents: 'none',
          },
        },
        h('div', {
          'aria-hidden': true,
          style: {
            position: 'absolute',
            right: 0,
            top: 0,
            width: '100%',
            height: 48,
            pointerEvents: item.visible ? 'auto' : 'none',
          },
        }),
        h(
          Actions,
          { 'data-visible': item.visible, 'data-markdown-copy': 'exclude' },
          item.fit || item.overflow
            ? h(
                Tooltip,
                { tooltipContent: wrap, delayOpen: true },
                h(
                  Button,
                  {
                    'aria-label': wrap,
                    color: 'blockAction',
                    radius: 'full',
                    size: 'inputIcon',
                    onClick: () => controller.toggle(),
                  },
                  h(item.fit ? wrapIcons.disable : wrapIcons.enable),
                ),
              )
            : null,
          h(CopyButton, {
            ariaLabel: copy,
            buttonText: copy,
            iconOnly: true,
            variant: 'blockAction',
            onCopy: () => navigator.clipboard.writeText(item.source).then(() => true),
          }),
          h(
            Tooltip,
            { tooltipContent: expand, delayOpen: true },
            h(
              Button,
              {
                ref: trigger,
                'aria-label': expand,
                'aria-expanded': open,
                'aria-haspopup': 'dialog',
                color: 'blockAction',
                radius: 'full',
                size: 'inputIcon',
                onClick: () => setOpen(true),
              },
              h(ExpandIcon),
            ),
          ),
        ),
      ),
      open
        ? h(TablePreview, {
            src: '',
            alt: preview,
            open: true,
            dialogAriaLabel: preview,
            closeAriaLabel: chinese ? '关闭表格预览' : 'Close table preview',
            showDownload: false,
            showZoomControls: false,
            onOpenChange: setOpen,
            onCloseAutoFocus: (event) => {
              event.preventDefault();
              trigger.current?.focus();
            },
            // 与原生消息流共用全屏外壳、表格组件和滚动材质，正文编辑器不参与重建。
            previewContent: h(
              'div',
              { className: `${tableClasses.MarkdownRoot} ${tableClasses.MarkdownTablePreview}` },
              h(
                'div',
                {
                  className: `${tableClasses.TableScroller} flex min-h-0 min-w-0 flex-1 overflow-auto bg-inherit`,
                  'aria-label': scroll,
                  role: 'region',
                  tabIndex: 0,
                },
                h(
                  'div',
                  { className: 'flex w-fit flex-col bg-inherit' },
                  h(Markdown, { tokens, components: { table: Table } }),
                  h('div', {
                    'aria-hidden': true,
                    className: 'pointer-events-none sticky bottom-0 h-2 w-full shrink-0 bg-inherit',
                  }),
                ),
                h('div', {
                  'aria-hidden': true,
                  className: 'pointer-events-none sticky end-0 top-0 h-full w-2 shrink-0 bg-inherit',
                }),
              ),
            ),
          })
        : null,
    );
  }
  controller.renderActions = (items) => {
    root.render(
      withProviders(
        React,
        h(React.Fragment, null, ...items.map((item) => h(TableActions, { key: item.id, item }))),
      ),
    );
  };
  controller.schedule();
  return () => {
    controller.renderActions = null;
    root.unmount();
    mount.remove();
  };
}
