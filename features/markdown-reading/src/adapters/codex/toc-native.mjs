// 直接导入原生 Marker、目录浮层和 Tooltip；仅按源码调用关系发现公开角色。
export async function loadNativeMarkdownToc() {
  const urls = [...document.querySelectorAll('link[rel="modulepreload"],script[src]')].map(
    (n) => n.href || n.src,
  );
  const initialUrl = urls.find((url) => /\/app-initial-[^/]+\.js/.test(url));
  const mainUrl = urls.find((url) => /\/app-main-[^/]+\.js/.test(url));
  if (!initialUrl || !mainUrl) throw new Error('native-page-toc-modules-unavailable');
  const read = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('native-page-toc-source-unavailable');
    return response.text();
  };
  const [initial, main] = await Promise.all([read(initialUrl), read(mainUrl)]);
  const candidates = [
    ...new Set([
      ...urls.filter((url) => /\/content-[^/]+\.js/.test(url)),
      ...[...initial.matchAll(/["']\.\/((?:content)-[\w-]+\.js)["']/g)].map(
        (m) => new URL(m[1], initialUrl).href,
      ),
    ]),
  ];
  let source, sourceUrl;
  for (const url of candidates) {
    const value = await read(url);
    if (
      value.includes('data-page-heading-id') &&
      value.includes('data-heading-preview') &&
      value.includes('PageEditorContent')
    ) {
      source = value;
      sourceUrl = url;
      break;
    }
  }
  if (!source) throw new Error('native-page-toc-components-unavailable');
  function bodyMatching(pattern) {
    const starts = [...source.matchAll(/function [\w$]+\(/g)].map((m) => m.index);
    const matches = starts
      .map((start, index) => source.slice(start, starts[index + 1] ?? source.length))
      .filter((body) => pattern.test(body));
    if (matches.length !== 1) throw new Error('native-page-toc-component-contract-changed');
    // 产物在函数之后声明闭包变量；只取原始函数体。
    const body = matches[0],
      end = body.lastIndexOf('}');
    return body.slice(0, end + 1);
  }
  const railBody = bodyMatching(/data-floating-navigation-rail-list.*data-scrubbing/);
  const listBody = bodyMatching(/data-heading-preview.*wrap-anywhere/);
  const imports = new Map();
  for (const match of source.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g))
    for (const entry of match[1].split(',')) {
      const parts = entry.trim().split(/\s+as\s+/);
      imports.set(parts.at(-1), { name: parts[0], url: new URL(match[2], sourceUrl).href });
    }
  const modules = new Map();
  async function binding(local, imported = imports) {
    const item = imported.get(local);
    if (!item) throw new Error('native-page-toc-dependency-contract-changed');
    if (!modules.has(item.url)) modules.set(item.url, import(item.url));
    return (await modules.get(item.url))[item.name];
  }
  const react = railBody.match(/\(0,([\w$]+)\.useState\)/)?.[1];
  const reactFactory = react && source.match(new RegExp(`\\b${react}=([\\w$]+)\\(\\)`))?.[1];
  if (!reactFactory) throw new Error('native-page-toc-react-unavailable');
  const React = (await binding(reactFactory))();
  const tooltipLocal = source.match(
    /jsx\)\(([\w$]+),\{align:`center`,delayOpen:!0,interactive:!0,side:`right`,sideOffset:0,skipDelayKey:`page-table-of-contents`/,
  )?.[1];
  const Tooltip = await binding(tooltipLocal);
  const layoutUrl = [...imports.values()].find((item) =>
    item.url.includes('/floating-navigation-rail-layout-'),
  )?.url;
  if (!layoutUrl) throw new Error('native-page-toc-layout-unavailable');
  const layout = await import(layoutUrl);
  for (const value of Object.values(layout))
    if (typeof value === 'function' && /^function ([\w$]+)\(\)\{return\(\1=/.test(String(value))) value();
  const rootOwner = main.match(/\(0,([\w$]+)\.createRoot\)/)?.[1];
  const rootFactory = rootOwner && main.match(new RegExp(`${rootOwner}=([\\w$]+)\\(\\)`))?.[1];
  const mainImports = new Map();
  for (const match of main.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g))
    for (const entry of match[1].split(',')) {
      const parts = entry.trim().split(/\s+as\s+/);
      mainImports.set(parts.at(-1), { name: parts[0], url: new URL(match[2], mainUrl).href });
    }
  const ReactDOM = (await binding(rootFactory, mainImports))();
  const css = initial.match(/["']\.\/((?:floating-navigation-rail-layout)-[\w-]+\.css)["']/)?.[1];
  if (!css) throw new Error('native-page-toc-styles-unavailable');
  const cssUrl = new URL(css, initialUrl).href;
  if (![...document.querySelectorAll('link[rel="stylesheet"]')].some((n) => n.href === cssUrl)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    document.head.append(link);
    await new Promise((resolve, reject) => {
      link.onload = resolve;
      link.onerror = () => reject(new Error('native-page-toc-styles-unavailable'));
    });
  }
  const component = (predicate) => {
    const matches = Object.values(layout).filter(
      (value) => typeof value === 'function' && predicate(String(value)),
    );
    if (matches.length !== 1) throw new Error('native-page-toc-layout-contract-changed');
    return matches[0];
  };
  const Marker = component((body) => body.includes('hierarchyLevel'));
  const Panel = component((body) => body.includes('shadow-xl-spread'));
  const requireClass = (body, pattern) => {
    const value = body.match(pattern)?.[1];
    if (!value) throw new Error('native-page-toc-class-contract-changed');
    return value;
  };
  const classes = {
    rail: requireClass(railBody, /ref:[\w$]+,className:`([^`]+)`,"data-floating-navigation-rail-list"/),
    railButton: requireClass(railBody, /className:`([^`]+)`,"aria-current"/),
    menu: requireClass(listBody, /ref:[\w$]+,className:`([^`]+)`,children:/),
    menuButton: requireClass(listBody, /className:[\w$]+\(`([^`]+)`/),
    nav: requireClass(source, /className:`(absolute top-1\/2 left-1\.5[^`]+)`/),
  };
  const indentName = listBody.match(/`block`,([\w$]+)\[e\.level\]/)?.[1];
  const indentValue = indentName && source.match(new RegExp(`\\b${indentName}=(\\[[^\\]]+\\])`))?.[1];
  if (!indentValue || !/^\[(?:void 0|`ms-\d+`|,)+\]$/.test(indentValue))
    throw new Error('native-page-toc-indent-contract-changed');
  const indentation = indentValue
    .slice(1, -1)
    .split(',')
    .map((value) => (value === 'void 0' ? '' : value.slice(1, -1)));
  if (!ReactDOM.createRoot || !React.createElement) throw new Error('native-page-toc-react-unavailable');
  return { Marker, Panel, Tooltip, React, ReactDOM, classes, indentation };
}
