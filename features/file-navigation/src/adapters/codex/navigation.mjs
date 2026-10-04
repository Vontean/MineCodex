import { loadFileNavigationModules } from './modules.mjs';

export function createFileNavigationAdapter(codex, loadModules = loadFileNavigationModules) {
  let pending;
  const modules = () => pending ??= loadModules().catch(error => { pending = null; throw error; });
  function read(nav) {
    const button = [...nav.querySelectorAll('button')].at(-1);
    const props = button && codex.props(button, p => typeof p.root === 'string' && typeof p.activePath === 'string' && typeof p.onSelectFile === 'function');
    if (!props || !nav.parentElement || !props.hostId) return null;
    const rootName = nav.querySelector('button')?.textContent;
    const separator = nav.querySelector('li > span')?.cloneNode(true);
    let boundary = nav.parentElement;
    while (boundary.parentElement && boundary.getBoundingClientRect().height < 160) boundary = boundary.parentElement;
    const key = JSON.stringify([props.hostId, props.root, props.activePath]);
    return {
      key, nav, capsule: nav.parentElement, boundary, rootName, path: props.activePath, separator,
      async list(directory, signal) {
        const { request } = await modules();
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const result = await request('workspace-directory-entries', { params: {
          hostId: props.hostId, workspaceRoot: props.root, directoryPath: directory || null, includeHidden: true,
        }, signal });
        if (!Array.isArray(result?.entries)) throw new Error('file-navigation-directory-contract-changed');
        return result.entries.map(entry => {
          if (typeof entry.path !== 'string' || !['file', 'directory'].includes(entry.type))
            throw new Error('file-navigation-entry-contract-changed');
          return { path: entry.path, name: entry.path.split('/').at(-1), directory: entry.type === 'directory' };
        });
      },
      open(entry) {
        if (entry.directory) return;
        props.onSelectFile(`${props.root.replace(/[\\/]$/, '')}/${entry.path}`, { isPreview: true });
      },
      async prepare() {
        const native = await modules();
        const providers = [], seen = new Set();
        for (let fiber = codex.currentFiber(nav); fiber; fiber = fiber.return) {
          if (fiber.tag !== 10 || seen.has(fiber.type)) continue;
          providers.push({ type: fiber.type, value: fiber.memoizedProps.value }); seen.add(fiber.type);
        }
        return {
          mountColumn(element, entries, selected, onSelect, onBack) {
            const { React, ReactDOM, Tree } = native;
            const root = ReactDOM.createRoot(element);
            const byName = new Map(entries.map(entry => [entry.name, entry]));
            const activate = event => {
              const row = event.nativeEvent.composedPath().find(node => node instanceof Element && node.hasAttribute('data-item-path'));
              const entry = byName.get(row?.getAttribute('data-item-path')?.replace(/\/$/, ''));
              if (entry) onSelect(entry);
            };
            let tree = React.createElement(Tree, {
              cwd: props.root, hostId: props.hostId, contextMenuEnabled: false, surface: 'dropdown', unsafeCSS: native.columnStyles,
              paths: entries.map(entry => ({ path: entry.path, displayPath: entry.name + (entry.directory ? '/' : '') })),
              selectedPath: entries.find(entry => entry.path === selected)?.name,
              initialExpandedPaths: [], flattenEmptyDirectories: false, revealSelectedPath: true, revealSelectedPathScrollOffset: 'center',
              onClick: activate,
            });
            for (const provider of providers) tree = React.createElement(provider.type, { value: provider.value }, tree);
            root.render(tree);
            const keys = event => {
              const row = event.composedPath().find(node => node instanceof Element && node.hasAttribute('data-item-path'));
              const entry = byName.get(row?.getAttribute('data-item-path')?.replace(/\/$/, ''));
              if (event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); onBack(); }
              if (entry && (event.key === 'Enter' || (event.key === 'ArrowRight' && entry.directory))) {
                event.preventDefault(); event.stopPropagation(); onSelect(entry);
              }
            };
            element.addEventListener('keydown', keys, true);
            return {
              dispose() { element.removeEventListener('keydown', keys, true); root.unmount(); },
              focus() {
                const shadow = element.querySelector('file-tree-container')?.shadowRoot;
                (shadow?.querySelector('[aria-selected="true"]') ?? shadow?.querySelector('[role="treeitem"]'))?.focus();
              },
            };
          },
        };
      },
    };
  }
  return {
    scan: () => [...document.querySelectorAll('nav:has(> ol)')].map(read).filter(Boolean),
  };
}
