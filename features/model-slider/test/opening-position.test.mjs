import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../src/frontend/install.mjs', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('  function centerGenericModelPicker('), source.indexOf('  // ========================================================================', source.indexOf('  function centerGenericModelPicker(')));
function fixture(zoom = 1) {
  const frames = new Map(), opening = new Map(), attributes = new Set(), values = new Map();
  let id = 0, anchorLeft = 100, anchorWidth = 120, baseLeft = 60;
  const signal = {aborted:false};
  const menu = {
    isConnected:true, currentCSSZoom:zoom,
    style:{visibility:'', getPropertyValue:key=>values.get(key), setProperty:(key,value)=>values.set(key,value), removeProperty(key){if(key==='visibility')this.visibility='';else values.delete(key);}},
    hasAttribute:key=>attributes.has(key), setAttribute:key=>attributes.add(key),
    getBoundingClientRect:()=>({left:baseLeft+(parseFloat(values.get('--codex-model-slider-menu-center-shift'))||0)*zoom,width:264*zoom}),
  };
  const trigger = {getBoundingClientRect:()=>({left:anchorLeft,width:anchorWidth})};
  const reveal = new Function('nativeComposerTrigger','modelSelectorOpeningFrames','requestAnimationFrame','signal',helpers+';return revealCenteredModelPicker;')(
    ()=>trigger,opening,callback=>{frames.set(++id,callback);return id;},signal,
  );
  const tick = () => {const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());};
  return {menu,signal,frames,opening,reveal:()=>reveal(menu),tick,
    move:()=>{anchorLeft=140;anchorWidth=180;baseLeft=95;},
    centered:()=>Math.abs(menu.getBoundingClientRect().left+132*zoom-anchorLeft-anchorWidth/2)<0.001,
  };
}

test('first reveal waits for stable centered geometry, including a late native Popper update',()=>{
  for(const zoom of [1,1.25,1.5]) {
    const f=fixture(zoom);f.reveal();f.reveal();assert.equal(f.frames.size,1);
    assert.equal(f.menu.style.visibility,'hidden');f.tick();assert.ok(f.centered());
    f.move();f.tick();assert.equal(f.menu.style.visibility,'hidden');assert.ok(f.centered());
    f.tick();assert.equal(f.menu.style.visibility,'');assert.equal(f.frames.size,0);
    f.reveal();assert.ok(f.centered());assert.equal(f.menu.style.visibility,'');
  }
});

test('closing or disposing while opening stops pending positioning',()=>{
  for(const mode of ['close','dispose']) {
    const f=fixture();f.reveal();f.tick();
    if(mode==='close')f.menu.isConnected=false;else f.signal.aborted=true;
    f.tick();assert.equal(f.frames.size,0);assert.equal(f.opening.size,0);
    assert.equal(f.menu.hasAttribute('data-codex-model-slider-opening-ready'),false);
  }
});

const triggerHelpers = source.slice(source.indexOf('  function isComposerModelPlaceholder('), source.indexOf('  function ensureModelSelector('));
test('open placeholder takes priority over the outgoing model label and measurement stays native',()=>{
  let observerCallback, observed;
  const attrs = new Map([['data-state','closed']]);
  const display = {textContent:'GPT 6.1 Sol',hasAttribute:()=>true};
  const measurement = {nodeValue:'Select effort'};
  const nativeLabel = {textContent:'gpt-6.1-sol',nextElementSibling:display};
  const trigger = {
    getAttribute:key=>attrs.get(key),setAttribute:(key,value)=>attrs.set(key,value),
    toggleAttribute:(key,value)=>value?attrs.set(key,''):attrs.delete(key),
    querySelectorAll:()=>[nativeLabel],
    querySelector:selector=>selector.includes('Placeholder')?{textContent:'Select effort'}:{firstChild:measurement},
  };
  const enhance = new Function('modelSelectorTriggerObservers','MutationObserver','queueEnsure','modelDisplayLabel','modelIdentity','restoreTriggerLabelWithoutNative','modelSelectorControllerMenu',triggerHelpers+';return enhanceComposerModelTrigger;')(
    new Map(),class {constructor(callback){observerCallback=callback;}observe(target,options){observed=options;}},()=>{},()=> 'GPT 6.1 Sol',raw=>raw,()=>{},null,
  );
  enhance(trigger,{});assert.equal(attrs.has('data-codex-model-slider-trigger-placeholder'),false);
  attrs.set('data-state','open');observerCallback();
  assert.equal(attrs.has('data-codex-model-slider-trigger-placeholder'),true);
  assert.ok(observed.attributeFilter.includes('data-state'));
  assert.equal(measurement.nodeValue,'Select effort');
  attrs.set('data-state','closed');observerCallback();
  assert.equal(attrs.has('data-codex-model-slider-trigger-placeholder'),false);
});
