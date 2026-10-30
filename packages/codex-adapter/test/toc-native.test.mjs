import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadNativeMarkdownToc } from '../src/markdown/toc-native.mjs';

for (const variant of ['legacy','modern','hashed']) {
  const modern=variant!=='legacy',hashed=variant==='hashed';
  test(`TOC discovers ${hashed ? 'hashed CSS from native lazy import dependencies' : modern ? 'current rail module and viewer layout' : 'legacy rail-layout module'}`, async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'minecodex-toc-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const rail = modern ? 'floating-navigation-rail-fixture' : 'floating-navigation-rail-layout-fixture';
    const nav = modern
      ? 'absolute top-[calc((100%+var(--page-comments-top-inset,0px))/2)] left-1.5 z-20 -translate-y-1/2 electron:left-2'
      : 'absolute top-1/2 left-1.5 z-20 -translate-y-1/2';
    const sources = {
      'package.json': '{"type":"module"}',
      'runtime.js': 'export const r=()=>({createElement(){}}),d=()=>({createRoot(){}}),t=()=>null;',
      [`${rail}.js`]: 'export function Marker(){return "hierarchyLevel"} export function Panel(){return "shadow-xl-spread"}',
      'app-initial-fixture.js': hashed ? 'const table={};table.f=["./abcd1234.css"];const lazy=()=>load(()=>import("./content-fixture.js"),__vite__mapDeps([0]),import.meta.url);' : `import './content-fixture.js';import './${rail}.css';`,
      'app-main-fixture.js': 'import{d as makeDOM}from"./runtime.js";var dom=makeDOM();(0,dom.createRoot)();',
      'content-fixture.js': [
        'import{r as makeReact,t as Tip}from"./runtime.js";',
        `import{Marker as M,Panel as P}from"./${rail}.js";`,
        'var react=makeReact();const PageEditorContent="data-page-heading-id";const indent=[void 0,`ms-0`,`ms-3`,`ms-6`];',
        'function rail(){(0,react.useState)();return {ref:r,className:`rail`,"data-floating-navigation-rail-list":true,"data-scrubbing":false,children:{className:`rail-button`,"aria-current":true}}}',
        `function list(){return {ref:r,className:\`menu\`,${modern ? 'variant:`viewer`,' : ''}children:{"data-heading-preview":true,className:cx(\`wrap-anywhere\`),children:cx(\`block\`,indent[e.level])}}}`,
        `function toc(){(0,j.jsx)(Tip,{align:\`center\`,delayOpen:!0,interactive:!0,side:\`right\`,sideOffset:0,skipDelayKey:\`page-table-of-contents\`});return (0,j.jsx)(\`nav\`,{"aria-label":label,className:\`${nav}\`,children:null})}`,
      ].join(''),
    };
    await Promise.all(Object.entries(sources).map(([name, source]) => writeFile(path.join(directory, name), source)));
    const url = name => pathToFileURL(path.join(directory, name)).href;
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const links = [];
    Object.defineProperty(globalThis, 'document', { configurable: true, value: {
      querySelectorAll: selector => selector.includes('modulepreload')
        ? [{ href: url('app-initial-fixture.js') }, { src: url('app-main-fixture.js') }]
        : links,
      createElement: () => ({}),
      head: { append(link) { links.push(link); queueMicrotask(() => link.onload()); } },
    } });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, 'document', previous);
      else delete globalThis.document;
    });
    t.mock.method(globalThis, 'fetch', async resource => ({ ok: true, text: () => readFile(fileURLToPath(resource), 'utf8') }));
    const native = await loadNativeMarkdownToc();
    assert.equal(typeof native.Marker, 'function');
    assert.equal(typeof native.Panel, 'function');
    assert.equal(typeof native.Tooltip, 'function');
    assert.equal(typeof native.React.createElement, 'function');
    assert.equal(typeof native.ReactDOM.createRoot, 'function');
    assert.deepEqual(native.classes, { rail: 'rail', railButton: 'rail-button', menu: 'menu', menuButton: 'wrap-anywhere', nav });
    assert.deepEqual(native.indentation, ['', 'ms-0', 'ms-3', 'ms-6']);
    assert.equal(links[0].href, url(hashed ? "abcd1234.css" : `${rail}.css`));
  });
}
