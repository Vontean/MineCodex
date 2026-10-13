const marker = 'data-minecodex-markdown-reading';
const native = createMarkdownPreviewAdapter(config.codex, config.resources);
const styled = new Map();
const sessions = new Map();
const tokenNames = ['--font-content', '--text-document', '--leading-relaxed', '--font-weight-semibold',
  '--color-token-main-surface-primary', '--color-token-bg-secondary', '--color-text-foreground',
  '--color-text-foreground-secondary', '--color-border'];
const style = document.createElement('style');
style.setAttribute('data-minecodex-markdown-reading-styles', '');
style.textContent = [config.resources.styles, config.resources.mermaidStyles].filter(Boolean).join('\n');
document.head.append(style);
let disposed = false;
let pending = null;

function release(editor) {
  const binding = styled.get(editor);
  sessions.get(editor)?.dispose();
  sessions.delete(editor);
  editor.removeAttribute(marker);
  binding?.();
  styled.delete(editor);
}
function reconcile() {
  pending = null;
  if (disposed) return;
  const previews = native.previews();
  const editors = new Set(previews.map((item) => item.editor));
  for (const editor of styled.keys()) if (!editors.has(editor)) release(editor);
  for (const preview of previews) {
    const { editor } = preview;
    if (!styled.has(editor)) styled.set(editor, config.ui.theme.bindScope(editor, tokenNames));
    if (!editor.hasAttribute(marker)) editor.setAttribute(marker, '');
    if (!sessions.has(editor)) sessions.set(editor, native.attach(preview));
  }
}

function schedule(records) {
  // 忽略原生选区与逐行装饰更新；只在预览视图或其祖先变化时重新定位。
  if (records.every((record) => record.target.closest?.('.cm-content, [data-mcx-reading-toc]'))) return;
  if (!disposed && pending === null) pending = window.requestAnimationFrame(reconcile);
}
const observer = new MutationObserver(schedule);
observer.observe(document.body, { childList: true, subtree: true });
reconcile();
config.registerSelfCheck?.(() => {
  const previews = native.previews();
  const styleAvailable =
    style.isConnected && previews.length > 0 && previews.every(({ editor }) => editor.hasAttribute(marker));
  const sessionChecks = previews.map(({ editor }) => sessions.get(editor)?.checks() ?? []);
  const checks = previews.length
    ? [
        { name: 'markdown-preview-styled', available: styleAvailable },
        ...(sessionChecks[0] ?? []).map((check) => ({
          name: check.name,
          available: sessionChecks.every((items) =>
            items.some((item) => item.name === check.name && item.available),
          ),
        })),
      ]
    : [];
  const available =
    styleAvailable &&
    sessionChecks.every((items) => items.length > 0) &&
    checks.every((check) => check.available);
  return {
    state: previews.length ? (available ? 'available' : 'unavailable') : 'not-applicable',
    reason: previews.length
      ? available
        ? null
        : styleAvailable
          ? 'markdown-reading-layout-unavailable'
          : 'markdown-style-unavailable'
      : 'no-markdown-preview',
    checks,
    scopes: previews.map(({ editor }) => ({ name: 'markdown-preview', element: editor })),
  };
});
return () => {
  disposed = true;
  observer.disconnect();
  if (pending !== null) window.cancelAnimationFrame(pending);
  for (const editor of styled.keys()) release(editor);
  style.remove();
};
