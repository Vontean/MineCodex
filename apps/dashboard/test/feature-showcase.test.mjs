import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const source = (await readFile(new URL('../assets/feature-showcase.js', import.meta.url), 'utf8'))
  .replace(/^import .*\n/, '').replace('export function', 'function');
class Element {
  constructor() {
    this.attrs = {}; this.dataset = {}; this.children = []; this.style = {};
    this.classList = {toggle() {}}; this.events = {}; this.nodes = {};
    this.hidden = false; this.paused = true; this.duration = 10; this.currentTime = 0;
  }
  querySelector(selector) {return this.nodes[selector] ??= new Element();}
  setAttribute(key, value) {this.attrs[key] = value;}
  getAttribute(key) {return this.attrs[key] ?? null;}
  removeAttribute(key) {delete this.attrs[key];}
  replaceChildren(...elements) {this.children = elements;}
  append(...elements) {this.children.push(...elements); this.firstChild = this.children[0];}
  addEventListener(key, fn) {(this.events[key] ??= []).push(fn);}
  fire(key) {for (const fn of this.events[key] ?? []) fn();}
  pause() {
    this.paused = true;
    // 模拟浏览器：尚未完成的播放请求会被 pause/load 中断。
    this.rejectPlay?.(new DOMException('The play request was interrupted', 'AbortError'));
    this.rejectPlay = null;
  }
  load() {}
  play() {
    this.paused = false;
    if (this.defer) return new Promise((resolve, reject) => {this.rejectPlay = reject;});
    return Promise.resolve();
  }
  set src(value) {this.attrs.src = value;}
  get src() {return this.attrs.src;}
}
function setup() {
  const root = new Element(), document = new Element(), window = new Element();
  let observer;
  document.hidden = false; document.createElement = () => new Element();
  window.minecodexPreviewMedia = {a: {video: 'a.mp4'}, b: {video: 'b.mp4'}};
  const context = vm.createContext({
    console, document, window, matchMedia: () => ({matches: false}), AbortController,
    IntersectionObserver: class {constructor(callback) {observer = callback;} observe() {}},
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout: () => 1, clearTimeout() {},
    previewContent: () => ['where', 'why', 'how'],
  });
  vm.runInContext(source + ';this.install = installFeatureShowcase', context);
  const api = context.install(root, 'en');
  return {root, api, video: root.querySelector('.showcase-video'),
    observe: ratio => observer([{isIntersecting: ratio > 0, intersectionRatio: ratio}])};
}
const flush = () => new Promise(setImmediate);
const features = [{id:'a',label:'A'},{id:'b',label:'B'}];
async function ready() { const x=setup(); x.api.setFeatures(features); await flush(); return x; }
test('showcase pauses below 35% visibility and resumes without changing user choice', async () => {
  const x=await ready();
  x.observe(.35); await flush(); assert.equal(x.video.paused,false);
  x.observe(.1); await flush(); assert.equal(x.video.paused,true);
  x.observe(.8); await flush(); assert.equal(x.video.paused,false);
});
test('switching a loading video ignores the interrupted playback request', async () => {
  const x=await ready(); x.video.defer=true; x.observe(1);
  x.root.querySelector('[data-showcase="next"]').fire('click'); await flush();
  assert.equal(x.video.src,'/assets/previews/b.mp4');
  assert.equal(x.root.querySelector('[data-showcase="toggle"]').getAttribute('aria-label'),'Pause demos');
  assert.equal(x.video.paused,false);
});
test('a stale permission rejection cannot pause the newly selected video', async () => {
  const x=await ready(); x.video.defer=true; x.observe(1);
  const reject=x.video.rejectPlay; x.video.rejectPlay=null;
  x.root.querySelector('[data-showcase="next"]').fire('click');
  reject(new DOMException('Blocked','NotAllowedError')); await flush();
  assert.equal(x.root.querySelector('[data-showcase="toggle"]').getAttribute('aria-label'),'Pause demos');
});
test('current autoplay refusal waits for an explicit user play action', async () => {
  const x=await ready(); x.video.defer=true; x.observe(1);
  x.video.rejectPlay(new DOMException('Blocked','NotAllowedError')); await flush();
  const toggle=x.root.querySelector('[data-showcase="toggle"]');
  assert.equal(toggle.getAttribute('aria-label'),'Play demos');
  x.video.defer=false; toggle.fire('click'); await flush();
  assert.equal(toggle.getAttribute('aria-label'),'Pause demos');
});
test('leaving the viewport while playback is pending preserves autoplay choice', async () => {
  const x=await ready(); x.video.defer=true; x.observe(1); x.observe(0); await flush();
  assert.equal(x.root.querySelector('[data-showcase="toggle"]').getAttribute('aria-label'),'Pause demos');
  x.video.defer=false; x.observe(1); await flush(); assert.equal(x.video.paused,false);
});

test('card activation selects its demo and scrolls without adding selection styling', async () => {
  const x=await ready();
  const card=new Element(); card.dataset.featureId='b'; card.querySelector('.plugin-name').textContent='B';
  const toggles=[]; card.classList.toggle=(...args)=>toggles.push(args);
  x.api.attach(card); x.api.setFeatures(features);
  let scroll; x.root.scrollIntoView=options=>{scroll=options;};
  card.children[0].fire('click'); await flush();
  assert.equal(x.video.src,'/assets/previews/b.mp4');
  assert.equal(scroll.block,'start'); assert.equal(scroll.behavior,'smooth');
  assert.deepEqual(toggles,[]);
  assert.equal(card.children[0].getAttribute('aria-current'),null);
});
