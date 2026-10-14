import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createMermaidViewport } from '../src/mermaid/viewport.mjs';
function setup() {
  class Surface extends EventTarget {
    style={}; dataset={}; scrollLeft=0; scrollTop=0;
    constructor(width,height){super();this.clientWidth=this.offsetWidth=width;this.clientHeight=this.offsetHeight=height;}
    getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
    closest(){return null;}
    setPointerCapture(){} hasPointerCapture(){return false;} releasePointerCapture(){}
  }
  class DetailEvent extends Event { constructor(type,options={}){super(type);this.detail=options.detail;} }
  const scene=new Surface(1200,800),viewport=new Surface(600,400),root=new Surface(600,440);
  root.querySelector=selector=>selector==='.scene'?scene:viewport;
  const window=new EventTarget();window.openai={displayMode:'inline'};window.innerHeight=440;
  const document=new EventTarget();
  const context={window,document,CustomEvent:DetailEvent,Event,ResizeObserver:class{observe(){}},requestAnimationFrame:()=>1};
  const create=vm.runInNewContext(`(${createMermaidViewport.toString()})`,context),view=create(root);
  const mode=value=>{window.openai.displayMode=value;window.dispatchEvent(new DetailEvent('openai:set_globals',{detail:{globals:{displayMode:value}}}));};
  const command=action=>root.dispatchEvent(new DetailEvent('mcx:qv-viewport',{detail:{action}}));
  return {scene,viewport,root,view,mode,command,create};
}
test('native viewer exposes the complete scene without a second scaling transform',()=>{
  const s=setup();s.mode('viewer');assert.equal(s.view.expanded,true);assert.equal(s.view.scale,1);
  assert.equal(s.viewport.style.height,'800px');assert.equal(s.viewport.style.overflow,'hidden');
  assert.ok(!s.scene.style.transform);assert.equal(s.create(s.root),s.view);
});
test('closing restores horizontal reading position',()=>{
  const s=setup();s.viewport.scrollLeft=130;s.viewport.dispatchEvent(new Event('scroll'));s.mode('viewer');s.mode('inline');
  assert.equal(s.view.expanded,false);assert.equal(s.viewport.style.height,'');assert.equal(s.viewport.scrollLeft,130);
});
test('wheel is forwarded to native zoom without changing diagram geometry',()=>{
  const s=setup();s.mode('viewer');let input;s.root.addEventListener('mcx:qv-viewer-input',e=>input=e.detail);
  const event=new Event('wheel',{cancelable:true});Object.assign(event,{clientX:120,clientY:80,deltaY:-100,deltaMode:0});s.viewport.dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);assert.equal(input.kind,'wheel');assert.equal(input.x,120);assert.equal(input.y,80);
  assert.equal(s.scene.offsetWidth,1200);assert.equal(s.scene.offsetHeight,800);assert.ok(!s.scene.style.transform);
});
test('drag passes a movement threshold, suppresses the click, and never announces a display-mode redraw',()=>{
  const s=setup();s.mode('viewer');const inputs=[];let redraws=0;s.root.addEventListener('mcx:qv-viewer-input',e=>inputs.push(e.detail));s.root.addEventListener('qv:display-mode',()=>redraws++);
  const pointer=(type,x,y)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:1,button:0,clientX:x,clientY:y});s.viewport.dispatchEvent(e);return e;};
  pointer('pointerdown',20,30);pointer('pointermove',22,32);assert.equal(inputs.filter(e=>e.kind==='drag').length,0);
  pointer('pointermove',50,60);pointer('pointerup',50,60);const click=new Event('click',{cancelable:true});s.viewport.dispatchEvent(click);
  assert.equal(click.defaultPrevented,true);assert.equal(inputs.find(e=>e.kind==='drag').dx,30);assert.equal(redraws,0);
});
