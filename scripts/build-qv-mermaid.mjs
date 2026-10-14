import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { parse } from 'acorn';
import { createMermaidViewport } from '../features/mermaid-diagrams/src/mermaid/viewport.mjs';
const source = new URL('../features/mermaid-diagrams/vendor/qv/source/', import.meta.url);
const output = new URL('../features/mermaid-diagrams/assets/', import.meta.url);
export async function buildQvLoading() {
  const template = await readFile(new URL('chart-loading.html', source), 'utf8');
  const script = template.match(/<script>([\s\S]*?)<\/script>/)[1];
  // 网点几何与绘制原样复用 QV；就绪、失败和卸载由 Preview 的真实状态结束。
  const drawing = script.slice(script.indexOf('let frame='), script.indexOf('function finish()'));
  const module = `// 由 scripts/build-qv-mermaid.mjs 从 QV chart-loading.html 生成，请勿手改。
export function createQvLoading(region) {
const field=document.createElement('div'),canvas=document.createElement('canvas');
field.className='qv-loading-field';canvas.className='qv-loading-canvas';field.setAttribute('aria-hidden','true');field.append(canvas);region.append(field);
region.setAttribute('data-mcx-qv-loading','');region.setAttribute('aria-busy','true');
const ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
${drawing}
return function finish(){if(done)return;done=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motion);field.remove();region.removeAttribute('data-mcx-qv-loading');region.setAttribute('aria-busy','false');};
}
`;
  const css = template.match(/<style>([\s\S]*?)<\/style>/)[1].replaceAll('{{LOADING_ID}}', 'mcx-qv-loading-source');
  const field = css.match(/#mcx-qv-loading-source>\.qv-loading-field\{[^}]+\}/)[0];
  const canvas = css.match(/#mcx-qv-loading-source \.qv-loading-canvas\{[^}]+\}/)[0];
  const keyframes = css.match(/@keyframes qv-field-mcx-qv-loading-source\{50%\{[^}]+\}\}/)[0];
  const reduced = css.match(/@media\(prefers-reduced-motion:reduce\)\{#mcx-qv-loading-source>\.qv-loading-field\{[^}]+\}\}/)[0];
  const styles = [field, canvas, keyframes, reduced].join('\n').replaceAll('qv-field-mcx-qv-loading-source','mcx-qv-loading-field')
    .replaceAll('#mcx-qv-loading-source','.mcx-reading-qv-status[data-mcx-qv-loading]')
    .replaceAll('var(--muted-foreground)','var(--mcx-color-text-foreground-secondary)') + '\n';
  return { module, styles };
}
export function staticQvScript(script) {
  const tree = parse(script, { ecmaVersion: 'latest', sourceType: 'script' }), edits = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && ['replay', 'playMotion', 'scheduleEntry', 'transitionView'].includes(node.id?.name)) {
      edits.push([node.body.start, node.body.end, '{}']); return;
    }
    if (node.type === 'NewExpression' && node.callee.name === 'IntersectionObserver') {
      edits.push([node.start, node.end, '__qvNoopObserver']); return;
    }
    if (node.type === 'CallExpression' && (node.callee.name === 'matchMedia'
      || (node.callee.type === 'MemberExpression' && node.callee.object.name === 'window' && node.callee.property.name === 'matchMedia'))
      && node.arguments[0]?.value?.includes('prefers-reduced-motion')) {
      edits.push([node.start, node.end, '__qvStaticMotion']); return;
    }
    if (node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression') {
      const call = node.expression;
      if (call.callee.type === 'MemberExpression' && call.callee.property.name === 'addEventListener'
        && (call.arguments[0]?.value === 'visibilitychange'
          || (call.arguments[0]?.value === 'change' && ['reduce', 'reduced'].includes(call.callee.object.name)))) {
        edits.push([node.start, node.end, '']); return;
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value?.type) visit(value);
    }
  }
  visit(tree);
  for (const [start, end, value] of edits.sort((a, b) => b[0] - a[0])) script = script.slice(0, start) + value + script.slice(end);
  return script;
}
// 阅读场景只保留有额外信息的提示；快照保持原样，差异集中在构建适配。
export function readingQvScript(script, name) {
  // 整图换行以 Preview 正文上限为基准，不改节点文字宽度或 vendor 快照。
  const limit = '(cfg.readingWidth||root.clientWidth)';
  if (name === 'mermaid-layout.js') {
    script = script.replace('data.nodes.length<16||Math.max(data.layout.width,data.layout.height)<2400||Math.max(data.layout.width/data.layout.height,data.layout.height/data.layout.width)<3', `data.layout.width<=${limit}`)
      .replace('const score=Math.abs(Math.log(w/h))', `const score=1000*Math.max(0,w/${limit}-1)+Math.abs(Math.log(w/h))`);
  }
  if (name === 'mermaid-class-model.js') {
    script = script.replace('data.nodes.length>=16&&Math.max(data.layout.width,data.layout.height)>=2400&&Math.max(data.layout.width/data.layout.height,data.layout.height/data.layout.width)>=3', `data.layout.width>${limit}&&['LR','RL'].includes(data.direction)`)
      .replace('ratio(data)>=ratio(initial)||data.layout.width*data.layout.height>initial.layout.width*initial.layout.height*1.3', 'data.layout.width>=initial.layout.width');
  }
  if (name === 'mermaid-navigation.js') script = script.replace('data.layout.width<=width', `data.layout.width<=${limit}`);
  const tree = parse(script, { ecmaVersion: 'latest' }), edits = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration') {
      const id = node.id.name;
      if ((name === 'mermaid-sequence.js' && id === 'placeTip') || (['mermaid-block.js','mermaid-c4.js'].includes(name) && id === 'showTip')) {
        edits.push([node.body.start, node.body.end, '{}']); return;
      }
      if (name === 'mermaid-architecture-reader.js' && id === 'reveal') {
        edits.push([node.body.start,node.body.end,'{if(pending!==epoch||!selected||!selected.anchor?.isConnected)return;highlight(selected.id);}']); return;
      }
      if (name === 'mermaid-sequence.js' && id === 'focus') {
        const firstTip = node.body.body.find(n => n.type === 'ExpressionStatement' && n.expression.callee?.name === 'placeTip');
        edits.push([firstTip.start, node.body.end - 1, '']); return;
      }
      if (name === 'mermaid-class.js' && id === 'showRelation') {
        edits.push([node.body.start, node.body.end, '{select(trigger,null,edge);}']); return;
      }
      if (['mermaid-er.js', 'mermaid-state.js'].includes(name) && id === 'show') {
        const gate = name === 'mermaid-er.js'
          ? node.body.body.find(n => n.type === 'IfStatement' && n.test.type === 'LogicalExpression' && n.test.left.argument?.name === 'selected')
          : node.body.body.find(n => n.type === 'IfStatement' && n.test.type === 'UnaryExpression' && n.test.argument.name === 'value');
        edits.push([gate.start, node.body.end - 1, '']); return;
      }
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value?.type) walk(value);
    }
  }
  walk(tree);
  for (const [start, end, value] of edits.sort((a,b) => b[0]-a[0])) script = script.slice(0,start)+value+script.slice(end);
  return script;
}
export async function buildQvTemplate({ motion = true } = {}) {
  let template = await readFile(new URL('mermaid.html', source), 'utf8');
  for (const match of [...template.matchAll(/\{\{([A-Z0-9_]+)_JS\}\}/g)]) {
    const name = match[1] === 'CHART_PRESETS' ? 'chart-presets.js' : `mermaid-${match[1].toLowerCase().replaceAll('_', '-')}.js`;
    const original = await readFile(new URL(name, source), 'utf8');
    const code = name === 'mermaid-viewport.js' ? createMermaidViewport.toString() : readingQvScript(original, name);
    template = template.replace(match[0], () => code);
  }
  template = template.replaceAll('{{ROOT_ID}}', 'mcx-qv-root').replaceAll('{{TITLE}}', '').replaceAll('{{TITLE_HIDDEN}}', 'hidden')
    .replaceAll('{{CONFIG_JSON}}', 'JSON.stringify(window.__mcxDiagramConfig)');
  const match = template.match(/<script>([\s\S]*?)<\/script>/);
  let script = motion ? match[1] : staticQvScript(match[1]);
  // 架构图始终展示全貌，不提供节点组开关或分组下钻；流程图保持原有能力。
  script = script.replace('navigationEnabled=!!data.groups?.length;', 'navigationEnabled=!!data.groups?.length&&!data.architecture;')
    .replace('root.dataset.hasGroups=String(navigationEnabled)', 'root.dataset.hasGroups=String(!!data.groups?.length)')
    .replace('async function setNavigationMode(enabled){', 'async function setNavigationMode(enabled){if(sourceModel.architecture)return;');
  script = script.replace("const crumbs=[{id:null,name:drilldownActive?'总览':'完整架构'},...path]", "const crumbs=drilldownActive?[{id:null,name:'总览'},...path]:[]");
  script = script.replace("(await import('https://cdn.jsdelivr.net/npm/mermaid@11.12.0/dist/mermaid.esm.min.mjs')).default", 'window.__mcxQVRuntime.mermaid')
    .replaceAll("await import('https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm')", 'window.__mcxQVRuntime.d3')
    .replaceAll("await import('https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/+esm')", 'window.__mcxQVRuntime.sankey');
  // 固定离线 ELK；其余模型、布局、绘制和 CSS 直接来自 QV 快照。
  const ast = parse(script, { ecmaVersion: 'latest' });
  const functionRanges = [];
  function walk(n) { if (!n || typeof n !== 'object') return; if(n.type==='FunctionDeclaration' && n.id?.name==='loadMermaidLayoutEngine') functionRanges.push([n.body.start,n.body.end]); for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v?.type)walk(v);} }
  walk(ast);
  for (const [start, end] of functionRanges.sort((a,b)=>b[0]-a[0])) script=script.slice(0,start)+'{if(!window.ELK)throw new Error("QV ELK unavailable");}'+script.slice(end);
  const viewportReady = 'document.addEventListener("qv:ready",event=>queueMicrotask(()=>{const root=event.target.closest?.(".qv-mermaid");if(root&&["enhanced","native"].includes(root.dataset.state))createMermaidViewport(root);}));';
  script = script.replace('(async()=>{', 'window.__mcxQVReady=(async()=>{'+viewportReady);
  const prefix = 'const __qvStaticMotion={matches:true,addEventListener(){},removeEventListener(){}};const __qvNoopObserver={observe(){},disconnect(){}};\n';
  return { markup: template.replace(match[0], ''), script: (motion ? "" : prefix) + script };
}
async function main() {
  const loading = await buildQvLoading();
  await writeFile(new URL('../src/mermaid/loading.mjs', output), loading.module);
  await writeFile(new URL('qv-loading.css', output), loading.styles);
  await writeFile(new URL('qv-template.json', output), JSON.stringify(await buildQvTemplate()));
  const result = await build({ stdin: { contents: `import mermaid from 'mermaid';import ELK from 'elkjs/lib/elk.bundled.js';import * as lucide from 'lucide';import * as d3 from 'd3';import * as sankey from 'd3-sankey';window.ELK=ELK;window.lucide={...lucide,createIcons:options=>lucide.createIcons({icons:lucide.icons,...options})};window.__mcxQVRuntime={mermaid,d3,sankey};`, resolveDir: fileURLToPath(new URL('../',import.meta.url)) }, bundle: true, minify: true, format: 'iife', platform: 'browser', target: 'chrome140', legalComments: 'eof', metafile:true, outfile: fileURLToPath(new URL('qv-dependencies.js', output)) });
  const exporter = await build({ stdin: { contents: "import {toBlob} from 'html-to-image';globalThis.__mcxQVExport={toBlob};", resolveDir:fileURLToPath(new URL('../',import.meta.url)) }, bundle:true,minify:true,format:'iife',platform:'browser',target:'chrome140',metafile:true,outfile:fileURLToPath(new URL('qv-export.js',output)) });
  const packages = new Map();
  for (const input of Object.keys({...result.metafile.inputs,...exporter.metafile.inputs})) {
    if (!input.includes('node_modules/')) continue;
    let directory = path.dirname(path.resolve(input));
    while (directory.includes('node_modules')) {
      try {
        const metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
        if (metadata.name) { packages.set(metadata.name, { directory, metadata }); break; }
      } catch {}
      directory = path.dirname(directory);
    }
  }
  let notices = 'Offline QV dependency bundle. Libraries are bundled without source edits.\n'
    + 'Original package sources: https://registry.npmjs.org/<name>/-/<basename>-<version>.tgz\n'
    + 'ELK source: https://github.com/kieler/elkjs/tree/v0.10.0 (EPL-2.0).\n';
  for (const [name, { directory, metadata }] of [...packages].sort(([a],[b])=>a.localeCompare(b))) {
    notices += `\n${'='.repeat(72)}\n${name}@${metadata.version} — ${metadata.license || 'see license below'}\n`;
    const licenses = (await readdir(directory)).filter(file => /^(license|licence|copying|notice)(\.|$)/i.test(file));
    if (!licenses.length) throw new Error(`Missing bundled dependency license: ${name}`);
    for (const file of licenses) notices += `\n${file}\n${await readFile(path.join(directory,file),'utf8')}\n`;
  }
  await writeFile(new URL('THIRD_PARTY_NOTICES.txt', new URL('../features/mermaid-diagrams/vendor/qv/',import.meta.url)),notices);
  console.log('QV reading template and pinned offline dependencies built.');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
