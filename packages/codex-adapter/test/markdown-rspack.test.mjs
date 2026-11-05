import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRspackMarkdownToc} from '../src/markdown/rspack.mjs';

test('registered Pages factories wait for their native lazy import before reading dependency exports',async()=>{
  let initialized=false,finish;
  const pending=new Promise(resolve=>{finish=()=>{initialized=true;resolve()}});
  const owner={id:'content',source:'function rail(){(0,react.useState)(false);R.jsx)(mark.M,{hierarchyLevel:level});ref:x,className:"rail","data-floating-navigation-rail-list":true;className:"rail-button","aria-current":true}function list(){"data-heading-preview":true;"page-table-of-contents";"block",indents[e.level];ref:x,className:"menu",variant:"viewer";className:(0,css.join)("menu-button",true)}function nav(){R.jsx)(tip.T,{align:"center",delayOpen:!0,interactive:!0,side:"right",sideOffset:0,skipDelayKey:"page-table-of-contents"});R.jsx)("nav",{"aria-label":label,className:"nav"})}let indents=[void 0,"ms-2"];'};
  const loader={id:'loader',source:'(load()).PageEditorContent'},root={id:'root',source:'exports.createRoot=function(){}'};
  const React={createElement(){}},ReactDOM={createRoot(){}},Marker=()=>{},Panel=()=> 'shadow-xl-spread',Tooltip=()=>{};
  const entries=[owner,loader,root];
  const registry={entries,module:predicate=>{const found=entries.filter(e=>predicate(e.source));assert.equal(found.length,1);return found[0]},lazy:async(entry,name)=>{assert.equal(entry,loader);assert.equal(name,'PageEditorContent');await pending;return owner},exports:entry=>{assert.equal(initialized,true,'must not read cache before native import settles');return entry===root?ReactDOM:{}},binding:(_entry,ref)=>{assert.equal(initialized,true,'must not read dependency before native import settles');return {react:React,mark:{Marker,Panel},'mark.M':Marker,'tip.T':Tooltip}[ref]},sourceOf:String};
  let completed=false;
  const result=loadRspackMarkdownToc(registry).then(value=>{completed=true;return value});
  await Promise.resolve();assert.equal(completed,false);
  finish();const native=await result;
  assert.equal(native.React,React);assert.equal(native.Marker,Marker);assert.equal(native.Panel,Panel);assert.equal(native.Tooltip,Tooltip);assert.deepEqual(native.indentation,['','ms-2']);
});
