import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { markdownMermaidSource, createQvResources, createQvFrame } from '../src/mermaid/frame.mjs';
import { createQvLoading } from '../src/mermaid/loading.mjs';
import { buildQvTemplate, staticQvScript, buildQvLoading, readingQvScript } from '../../../scripts/build-qv-mermaid.mjs';

const feature = new URL('../', import.meta.url);
test('closed Mermaid fences preserve every diagram type and presentation directive as data', () => {
  for (const source of ['flowchart LR\n A --> B', 'sequenceDiagram\n A->>B: 查询',
    'flowchart LR\n A:::blue --> B\n classDef blue fill:blue', '%%{init: {"theme":"dark"}}%%\nflowchart LR\n A --> B']) {
    for (const fence of ['```', '~~~~']) assert.equal(markdownMermaidSource(`${fence}mermaid\n${source}\n${fence}`), source);
  }
  assert.equal(markdownMermaidSource('```mermaid\nflowchart LR\n A --> B'), null);
  assert.equal(markdownMermaidSource(`\`\`\`mermaid\n${' '.repeat(50001)}\n\`\`\``), null);
});
test('bundled QV source agrees with the recorded upstream snapshot', async () => {
  const provenance = JSON.parse(await readFile(new URL('vendor/qv/provenance.json', feature), 'utf8'));
  for (const [file, expected] of Object.entries(provenance.files)) {
    const content = await readFile(new URL(`vendor/qv/source/${file}`, feature));
    assert.equal(createHash('sha256').update(content).digest('hex'), expected, file);
  }
});
test('static transform removes replay triggers but keeps layout, hover and resize logic', () => {
  const source = `function replay(){ node.animate([],{}); }
function draw(){node.style.left='10px';}
function hover(){ node.style.opacity='.3'; }
new IntersectionObserver(replay).observe(node);
new ResizeObserver(draw).observe(node);
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
document.addEventListener('visibilitychange',replay);
reduced.addEventListener('change',replay);`;
  const result = staticQvScript(source);
  assert.ok(!result.includes('.animate('));
  assert.ok(!result.includes('visibilitychange'));
  assert.ok(!result.includes("addEventListener('change'"));
  assert.ok(!result.includes('new IntersectionObserver'));
  assert.ok(result.includes("node.style.left='10px'"));
  assert.ok(result.includes("node.style.opacity='.3'"));
  assert.ok(result.includes('new ResizeObserver(draw)'));
});
test('shipped template is reproducible and contains no unresolved includes or CDN imports', async () => {
  const compiled = await buildQvTemplate();
  const shipped = JSON.parse(await readFile(new URL('assets/qv-template.json',feature),'utf8'));
  assert.deepEqual(shipped, compiled);
  assert.ok(!/\{\{[A-Z0-9_]+\}\}/.test(compiled.markup + compiled.script));
  assert.ok(!/import\(['"]https:/.test(compiled.script));
  assert.ok(compiled.script.includes("securityLevel:'strict'"));
  assert.ok(compiled.script.includes('window.__mcxQVRuntime.mermaid'));
});
test('window.matchMedia uses static motion too so preset charts are not left hidden', () => {
  const script = staticQvScript("const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');if(!reduced.matches)svg.hidden=true;");
  const svg = { hidden: false };
  vm.runInNewContext(script, { svg, __qvStaticMotion: { matches: true } });
  assert.equal(svg.hidden, false);
});
test('reading template retains QV entry and re-entry motion by default', async () => {
  const compiled = await buildQvTemplate();
  assert.ok(compiled.script.includes('new IntersectionObserver'));
  assert.ok(compiled.script.includes('.animate('));
  assert.ok(!compiled.script.includes('const __qvStaticMotion='));
});
test('missing assets fail before replacing native widgets', () => {
  assert.throws(()=>createQvResources({}), /qv-resources-unavailable/);
  assert.throws(()=>createQvResources({qvTemplate:{script:'x'}}), /qv-resources-unavailable/);
});
test('loading adapter is reproducible from the QV snapshot without changing chart tooltip styles', async () => {
  const compiled = await buildQvLoading();
  assert.equal(await readFile(new URL('src/mermaid/loading.mjs',feature),'utf8'),compiled.module);
  assert.equal(await readFile(new URL('assets/qv-loading.css',feature),'utf8'),compiled.styles);
  assert.ok(!compiled.styles.includes('{{'));
  assert.ok(!compiled.styles.includes('tooltip'));
  assert.ok(compiled.styles.includes('1.75s ease-in-out infinite'));
});
test('dot loading pauses while hidden and stops all work on readiness or disposal', () => {
  const frames=new Map(),listeners=new Map(),motionListeners=new Map();
  let next=0,painted=0,observer;
  const ctx={setTransform(){},clearRect(){},beginPath(){},arc(){},fill(){painted++;}};
  class Element {
    constructor(){this.children=[];this.attrs=new Map();}
    append(child){this.children.push(child);child.parent=this;}
    setAttribute(k,v){this.attrs.set(k,v);}
    removeAttribute(k){this.attrs.delete(k);}
    getBoundingClientRect(){return {width:736,height:248};}
    getContext(){return ctx;}
    remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
  }
  const region=new Element(),reduced={matches:false,addEventListener:(k,fn)=>motionListeners.set(k,fn),removeEventListener:k=>motionListeners.delete(k)};
  const document={hidden:false,createElement:()=>new Element(),addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)};
  const context={document,devicePixelRatio:2,matchMedia:()=>reduced,getComputedStyle:()=>({color:'#71717a'}),
    requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id),
    ResizeObserver:class{constructor(fn){this.fn=fn;observer=this;}observe(){this.fn();}disconnect(){this.disconnected=true;}}};
  const finish=vm.runInNewContext(`(${createQvLoading.toString()})`,context)(region);
  const tick=now=>{const [id,fn]=frames.entries().next().value;frames.delete(id);fn(now);};
  tick(40);assert.ok(painted>0);assert.equal(frames.size,1);
  document.hidden=true;listeners.get('visibilitychange')();assert.equal(frames.size,0);
  document.hidden=false;listeners.get('visibilitychange')();assert.equal(frames.size,1);
  reduced.matches=true;motionListeners.get('change')();tick(80);assert.equal(frames.size,0);
  finish();finish();assert.equal(region.children.length,0);assert.equal(region.attrs.get('aria-busy'),'false');
  assert.equal(listeners.size,0);assert.equal(motionListeners.size,0);assert.equal(observer.disconnected,true);
  observer.fn();assert.equal(frames.size,0);
});
test('script URLs are shared across previews in one document and revoked with the last release', () => {
  delete globalThis.__mcxQvScripts;
  const resources = { qvTemplate: { markup: '<div></div>', script: 'renderer-source' }, qvDependencies: 'dependency-source' };
  const first = createQvResources(resources);
  const second = createQvResources(resources);
  // 同一文档内重复接入复用同一对 URL，图表数量不再放大 Blob 数量。
  assert.equal(first.dependencies, second.dependencies);
  assert.equal(first.renderer, second.renderer);
  assert.notEqual(first.dependencies, first.renderer);
  assert.equal(globalThis.__mcxQvScripts.size, 2);
  assert.deepEqual([...globalThis.__mcxQvScripts.values()].map(entry => entry.refs), [2, 2]);
  // 仍有一个预览持有时不回收，最后一个释放时才撤销。
  first.dispose();
  assert.equal(globalThis.__mcxQvScripts.size, 2);
  second.dispose();
  assert.equal(globalThis.__mcxQvScripts.size, 0);
  // 释放后重新接入会建立新的 URL，不会复活已撤销的地址。
  const third = createQvResources(resources);
  assert.notEqual(third.dependencies, first.dependencies);
  third.dispose();
  assert.equal(globalThis.__mcxQvScripts.size, 0);
});
test('frame authenticates messages, encodes source as data, reports timeout and releases ownership', () => {
  let listener, timeout, cleared=false, removed=false;
  const ready=[], heights=[], sent=[];
  const contentWindow={postMessage:(...args)=>sent.push(args)};
  const frame={style:{},setAttribute(){},contentWindow,remove(){removed=true;}};
  const context={document:{createElement:()=>frame,documentElement:{lang:'en'}},crypto:{randomUUID:()=> 'nonce'},
    window:{addEventListener:(name,fn)=>listener=fn,removeEventListener:(name,fn)=>assert.equal(fn,listener)},
    setTimeout:fn=>{timeout=fn;return 1;},clearTimeout:()=>{cleared=true;}};
  const create=vm.runInNewContext(`(${createQvFrame.toString()})`,context);
  const controller=create('</script><script>evil()</script>',{template:{markup:'<div></div>'},dependencies:'deps',renderer:'renderer'},
    {tokens:{}},height=>heights.push(height),state=>ready.push(state),()=>{});
  assert.ok(!frame.srcdoc.includes('<script>evil()'));
  listener({source:{},data:{type:'mcx-qv-bootstrap',token:'nonce'}});
  listener({source:contentWindow,data:{type:'mcx-qv-bootstrap',token:'wrong'}});
  assert.equal(sent.length,0);
  listener({source:contentWindow,data:{type:'mcx-qv-bootstrap',token:'nonce'}});
  assert.equal(sent[0][0].dependencies,'deps');
  listener({source:contentWindow,data:{type:'mcx-qv',token:'nonce',state:'loading',height:500}});
  assert.equal(ready.length,0);
  timeout();assert.deepEqual(ready,['error']);
  listener({source:contentWindow,data:{type:'mcx-qv',token:'nonce',state:'enhanced',height:500}});
  assert.deepEqual(heights,[500]);assert.ok(cleared);
  controller.dispose();assert.ok(removed);
  listener({source:contentWindow,data:{type:'mcx-qv',token:'nonce',state:'enhanced',height:700}});
  assert.deepEqual(heights,[500]);
});

test('flow chooses the narrower main axis using the reading maximum without snake folding', async () => {
  const source = await readFile(new URL('vendor/qv/source/mermaid-layout.js',feature),'utf8');
  const context = vm.createContext({cfg:{readingWidth:736},root:{clientWidth:480,dataset:{}}});
  vm.runInContext(readingQvScript(source,'mermaid-layout.js'),context);
  let calls=[];
  context.prepareMermaidLayout = async data => { calls.push(data.direction);data.layout={width:data.widths[data.direction],height:104}; };
  const make = (lr,tb,direction='LR') => ({direction,nodes:[],groups:[],widths:{LR:lr,TB:tb}});
  const below=make(736,400);await context.prepareFlowchartLayout(below);
  assert.deepEqual(calls,['LR']);assert.equal(below.direction,'LR');assert.equal(below.balanced,false);
  calls=[];const fits=make(737,500);await context.prepareFlowchartLayout(fits);
  assert.deepEqual(calls,['LR','TB']);assert.equal(fits.direction,'TB');
  calls=[];const narrower=make(2000,900);await context.prepareFlowchartLayout(narrower);
  assert.equal(narrower.layout.width,900);assert.equal(narrower.direction,'TB');
  calls=[];const original=make(900,2000);await context.prepareFlowchartLayout(original);
  assert.deepEqual(calls,['LR','TB','LR']);assert.equal(original.direction,'LR');
  calls=[];const vertical=make(600,900,'TB');await context.prepareFlowchartLayout(vertical);
  assert.deepEqual(calls,['TB','LR']);assert.equal(vertical.direction,'LR');
});
test('entry batches preserve ordering within 1200ms and do not replace native animate', async () => {
  const source=await readFile(new URL('src/mermaid/qv-motion.js',feature),'utf8');
  const animations=[],microtasks=[];
  const element={animate(frames,timing){const effect={getTiming:()=>timing,updateTiming:value=>Object.assign(timing,value)};const a={frames,effect};animations.push(a);return a;}};
  const native=element.animate,context=vm.createContext({queueMicrotask:fn=>microtasks.push(fn)});
  vm.runInContext(source,context);context.element=element;
  vm.runInContext("animateMermaidEntry(element,[{transform:'scale(.08)'},{transform:'scale(1)'}],{duration:650,delay:110});animateMermaidEntry(element,[{opacity:0},{opacity:1}],{duration:50,delay:2080})",context);
  assert.equal(element.animate,native);assert.equal(microtasks.length,1);microtasks[0]();
  const times=animations.map(a=>a.effect.getTiming());
  assert.ok(Math.abs(times[1].delay+times[1].duration-1200)<.001);
  assert.ok(times[0].delay+times[0].duration<times[1].delay,'arrows follow their lines');
  assert.equal(animations[0].frames[0].transform,'scale(0.92)');
  assert.equal(animations[0].frames[0].opacity,0);
});
test('complete grouped diagrams do not ship a navigation switch or drilldown functions', async () => {
  const {script,markup}=await buildQvTemplate();
  assert.ok(!script.includes('cfg.navigation'));
  assert.ok(!/function (navigateScope|setNavigationMode|mermaidScopeView)\(/.test(script));
  assert.ok(!markup.includes('<nav class="scope-nav"'));
  assert.ok(!script.includes('Element.prototype.animate'));
});
test('group direction comparison uses the reading maximum and preserves explicit connection faces', async () => {
  const source = await readFile(new URL('vendor/qv/source/mermaid-navigation.js',feature),'utf8');
  const context = vm.createContext({cfg:{readingWidth:736},root:{clientWidth:480}});
  vm.runInContext(readingQvScript(source,'mermaid-navigation.js'),context);
  let comparisons=0;
  context.prepareNavigationView=async()=>{};
  context.prepareMermaidLayout=async data=>{comparisons++;data.layout={width:400};};
  const make = (width,edges=[]) => ({scope:'group',direction:'LR',layout:{width},nodes:[],edges,groups:[]});
  const narrow = make(600);await context.prepareCompleteScope(narrow,480);
  assert.equal(comparisons,0);assert.equal(narrow.direction,'LR');
  const wide = make(800);await context.prepareCompleteScope(wide,480);
  assert.equal(comparisons,1);assert.equal(wide.direction,'TB');
  await context.prepareCompleteScope(make(800,[{fromSide:'EAST'}]),480);
  assert.equal(comparisons,1);
});
