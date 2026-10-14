// 当前原生 Markdown Preview 是 CodeMirror 视图；Source 与 Pages 不属于此契约。
export function createMarkdownPreviewAdapter(codex, attach) {
  function preview(editor) {
    if (!editor.isConnected || !editor.closest('[data-editor-search-surface]')) return null;
    const content = editor.querySelector('.cm-content[data-language="markdown"]');
    const scroller = editor.querySelector('.cm-scroller');
    if (!content || !scroller) return null;
    const file = codex.props(
      editor,
      (props) =>
        props.fileKind === 'markdown' && typeof props.filePath === 'string' && 'onSaveChange' in props,
    );
    const mode =
      file &&
      codex.props(
        editor,
        (props) =>
          props.filePath === file.filePath && 'initialMode' in props && 'onSourceDraftChange' in props,
      );
    return mode ? { editor, content, scroller } : null;
  }
  function previews() {
    const items = [...document.querySelectorAll('.cm-editor')].map(preview).filter(Boolean);
    codex.report('markdown-preview', items.length > 0, items.length ? null : 'no-markdown-preview');
    return items;
  }
  return {
    preview,
    previews,
    attach(item) { return attach(item); },
  };
}
