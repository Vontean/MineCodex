import { captureMarkdownProviders } from '../../../../../packages/codex-adapter/src/markdown/providers.mjs';

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
          h(
            Tooltip,
            { tooltipContent: wrap, delayOpen: true },
            h(
              Button,
              {
                'aria-label': wrap,
                'aria-pressed': item.fit,
                color: 'blockAction',
                radius: 'full',
                size: 'inputIcon',
                onClick: () => controller.toggle(),
              },
              h(item.fit ? wrapIcons.disable : wrapIcons.enable),
            ),
          ),
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
