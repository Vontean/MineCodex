import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { installFeatureTooltips } from "../src/components/tooltip.mjs";

class Node extends EventTarget {
  attributes=new Map(); children=[]; isConnected=true; hidden=false; offsetWidth=80; offsetHeight=20;
  style={setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}};
  getAttribute(name){return this.attributes.get(name)??null;}
  setAttribute(name,value){this.attributes.set(name,value);}
  removeAttribute(name){this.attributes.delete(name);}
  append(node){this.children.push(node);node.isConnected=true;}
  remove(){this.isConnected=false;}
  closest(selector){return selector.includes("data-app-navigation-rail")?this.rail??null:this;}
  contains(node){return node===this;}
  getClientRects(){return [{}];}
  getBoundingClientRect(){return {left:40,right:100,top:100,bottom:140,width:60,height:40};}
}
function fixture(t){
  const document=new EventTarget(),window=new EventTarget();
  Object.assign(document,{head:new Node(),body:new Node(),createElement:()=>{const node=new Node();node.isConnected=false;return node;}});
  let now=1000, timer=null;
  const controller=new AbortController();
  vm.runInNewContext(`(${installFeatureTooltips.toString()})`,{document,window,Element:Node,
    innerWidth:1000,innerHeight:800,Date:{now:()=>now},
    getComputedStyle:()=>({zoom:"2",getPropertyValue:name=>({"--radius-2xl":"20px","--codex-corner-shape":"superellipse(1.5)"}[name]??"")}),
    requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},
    setTimeout:(fn,delay)=>{timer={fn,delay};return 1;},clearTimeout:()=>{timer=null;},
  })(controller.signal);
  t.after(()=>controller.abort());
  function event(type,target,relatedTarget=null){const e=new Event(type);Object.defineProperty(e,"target",{value:target});e.relatedTarget=relatedTarget;document.dispatchEvent(e);}
  return {document,event,timer:()=>timer,advance:ms=>{now+=ms;},tip:()=>document.body.children[0]};
}
test("navbar tooltip uses native delay, right-side coordinates with zoom and hover handoff",t=>{
  const f=fixture(t),anchor=new Node();anchor.rail=new Node();anchor.setAttribute("data-minecodex-tooltip","Prompts");anchor.setAttribute("aria-describedby","existing");
  f.event("pointerover",anchor);assert.equal(f.timer().delay,200);f.timer().fn();
  const tip=f.tip();assert.equal(tip.style.left,"51px");assert.equal(tip.style.top,"50px");
  assert.equal(tip.style["--radius-2xl"],"20px");assert.equal(tip.style["--codex-corner-shape"],"superellipse(1.5)");
  assert.equal(anchor.getAttribute("aria-describedby"),"existing minecodex-feature-tooltip");
  f.event("pointerout",anchor);assert.equal(tip.hidden,true);assert.equal(anchor.getAttribute("aria-describedby"),"existing");
  f.advance(299);f.event("pointerover",anchor);assert.equal(f.timer().delay,0);f.timer().fn();
  f.event("pointerout",anchor);f.advance(301);f.event("pointerover",anchor);assert.equal(f.timer().delay,200);
});
test("leaving before delay cancels tooltip and keyboard focus is immediate",t=>{
  const f=fixture(t),anchor=new Node();anchor.setAttribute("data-minecodex-tooltip","Prompts");
  f.event("pointerover",anchor);f.event("pointerout",anchor);assert.equal(f.timer(),null);assert.equal(f.tip(),undefined);
  f.event("focusin",anchor);assert.equal(f.timer().delay,0);f.timer().fn();
  assert.equal(f.tip().style.top,"29px");f.event("pointerdown",anchor);assert.equal(f.tip().hidden,true);
  anchor.setAttribute("aria-expanded","true");f.event("pointerover",anchor);assert.equal(f.timer(),null);
});
