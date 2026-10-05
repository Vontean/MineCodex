import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {installMcpNavigationIcons} from '../src/native/mcp-navigation.mjs';
import {createNativeRailAdapter} from '../src/native/navigation-rail.mjs';
import {createCodexEnvironment} from '../../codex-adapter/src/renderer/environment.mjs';

class Node {
  attributes = new Map();
  getAttribute(name) {return this.attributes.get(name) ?? null;}
  setAttribute(name,value) {this.attributes.set(name,value);}
  removeAttribute(name) {this.attributes.delete(name);}
  hasAttribute(name) {return this.attributes.has(name);}
  querySelector() {return this.image;}
}
function fixture() {
  const node = new Node(), image = new Node();node.image=image;image.setAttribute('href','native-default');
  node.setAttribute('data-sidebar-destination','mcp:prompt');
  const entry = {path:'/mcp-app/plugins/minecodex%40minecodex-local/minecodex_prompts_open',source:{server:'plugin_minecodex',pluginId:'minecodex@minecodex-local'}};
  const icon = {props:{entry,fallback:{}}};
  const item = {id:'mcp:prompt',railIcons:{default:icon,selected:icon}};
  node.__reactFiberFixture={memoizedProps:{item}};
  let changed, disconnected=false, nodes=[node];
  const install = vm.runInNewContext(`(${installMcpNavigationIcons.toString()})`,{
    document:{documentElement:{},querySelectorAll:()=>nodes},
    MutationObserver:class {constructor(fn){changed=fn;}observe(){}disconnect(){disconnected=true;}},
  });
  const lifetime=new AbortController();
  install(lifetime.signal,createNativeRailAdapter(createCodexEnvironment()),{server:'minecodex',pluginId:'minecodex@minecodex-local',icons:[
    {tool:'minecodex_prompts_open',default:'prompt-outline',selected:'prompt-filled'},
    {tool:'minecodex_open',default:'mcx-outline',selected:'mcx-filled'},
  ]});
  return {node,image,entry,item,lifetime,changed:()=>changed(),disconnected:()=>disconnected,remove:()=>{nodes=[];}};
}
test('native MCP entry props select filled mask without replacing SVG or changing native attributes',()=>{
  const f=fixture();assert.equal(f.image.getAttribute('href'),'prompt-outline');
  f.node.setAttribute('aria-current','page');f.changed();assert.equal(f.image.getAttribute('href'),'prompt-filled');
  assert.equal(f.node.image,f.image);assert.equal(f.node.getAttribute('aria-current'),'page');
  f.node.removeAttribute('aria-current');f.node.setAttribute('data-selected','');f.changed();assert.equal(f.image.getAttribute('href'),'prompt-filled');
  f.node.setAttribute('data-selected','false');f.changed();assert.equal(f.image.getAttribute('href'),'prompt-outline');
  f.lifetime.abort();assert.equal(f.image.getAttribute('href'),'native-default');assert.equal(f.disconnected(),true);
});
test('reused entries restore foreign and unknown tools, and use the right MCX resource',()=>{
  const f=fixture();f.node.setAttribute('aria-current','page');f.changed();
  f.entry.path='/mcp-app/minecodex/minecodex_open';f.changed();assert.equal(f.image.getAttribute('href'),'mcx-filled');
  f.entry.source={server:'other'};f.changed();assert.equal(f.image.getAttribute('href'),'native-default');
  f.image.setAttribute('href','other-icon');f.changed();assert.equal(f.image.getAttribute('href'),'other-icon');
  f.entry.source={server:'minecodex'};f.entry.path='/mcp-app/minecodex/unknown';f.changed();assert.equal(f.image.getAttribute('href'),'other-icon');
  f.entry.path='/mcp-app/minecodex/%E0%A4%A';f.changed();assert.equal(f.image.getAttribute('href'),'other-icon');
});
test('React image replacement and native resource updates retain their own restoration values',()=>{
  const f=fixture();f.image.setAttribute('href','new-native-default');f.changed();
  const replacement=new Node();replacement.setAttribute('href','replacement-default');f.node.image=replacement;f.changed();
  assert.equal(f.image.getAttribute('href'),'new-native-default');assert.equal(replacement.getAttribute('href'),'prompt-outline');
  f.remove();f.changed();assert.equal(replacement.getAttribute('href'),'replacement-default');
  f.lifetime.abort();assert.equal(replacement.getAttribute('href'),'replacement-default');
});
test('native writes after the final reconciliation are not overwritten on abort',()=>{
  const f=fixture();f.image.setAttribute('href','react-current');f.lifetime.abort();assert.equal(f.image.getAttribute('href'),'react-current');
});
