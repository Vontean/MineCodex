import { createCodexEnvironment } from "../../codex-adapter/src/renderer/environment.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { installNavigationRail } from "../src/components/navigation-rail.mjs";
import { createNativeRailAdapter } from "../src/native/navigation-rail.mjs";

class Node {
  attributes = new Map(); style = {}; children = []; isConnected = true;
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  after(node) { const i = this.parent.children.indexOf(this); node.parent = this.parent; this.parent.children.splice(i+1,0,node); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node=>node!==this); this.isConnected=false; }
  cloneNode() { const node=new Node(); node.attributes=new Map(this.attributes); node.innerHTML=this.innerHTML; return node; }
  closest() { return this.rail; }
  querySelector() { return this.children.find(node=>!node.hasAttribute("data-mcx-native-rail-icon")); }
  querySelectorAll(selector) { return selector === "[data-sidebar-destination]" ? this.children : this.children.filter(node=>node.hasAttribute("data-mcx-rail-glyph")); }
}
test("injected navigation owns selection and restores native attributes and React-owned icon", () => {
  const document={head:new Node(),createElement:()=>new Node(),createElementNS:()=>new Node()};
  const adapter=vm.runInNewContext(`(${createNativeRailAdapter.toString()})`,{document})(createCodexEnvironment());
  const controller=new AbortController();
  const ui=vm.runInNewContext(`(${installNavigationRail.toString()})`,{document})(controller.signal,{},adapter);
  const rail=new Node(),home=new Node(),button=new Node(),outline=new Node(),filled=new Node(),nativeIcon=new Node();
  home.setAttribute("data-sidebar-destination","builtin:codex");home.setAttribute("data-selected","");home.setAttribute("aria-current","page");
  const item={id:"builtin:codex",isCurrentDestination:true,railIcons:{default:{props:{asset:{paint:{kind:"monochrome"},canvas:{width:20,height:20,viewBox:"0 0 20 20"},body:'<path fill="none"/>'}}}}};
  home.__reactFiber$test={memoizedProps:{},return:{memoizedProps:{item}}};
  home.append(nativeIcon);rail.append(home);button.rail=rail;button.append(outline);
  const entry=ui.navigationRail(button,{defaultIcon:outline,selectedIcon:filled});
  entry.select(true);
  assert.equal(button.getAttribute("aria-current"),"page");assert.equal(outline.style.display,"none");assert.equal(filled.style.display,"");
  assert.equal(home.hasAttribute("data-selected"),false);assert.equal(home.hasAttribute("aria-current"),false);
  assert.equal(home.hasAttribute("data-suppress-active-style"),true);
  assert.equal(nativeIcon.hasAttribute("data-mcx-native-rail-icon-hidden"),true);
  assert.equal(home.children[1].innerHTML,'<path fill="none"/>');
  const replacement=home.children[1];entry.select(true);assert.equal(home.children[1],replacement);
  // 原生 React 重渲染替换 SVG，组件只清理自己创建的替身。
  nativeIcon.remove();const nextIcon=new Node();home.append(nextIcon);entry.select(true);
  assert.equal(replacement.isConnected,false);assert.equal(nextIcon.hasAttribute("data-mcx-native-rail-icon-hidden"),true);
  entry.select(false);
  assert.equal(home.getAttribute("aria-current"),"page");assert.equal(home.hasAttribute("data-selected"),true);
  assert.equal(home.hasAttribute("data-suppress-active-style"),false);assert.equal(home.children.length,1);
  assert.equal(nextIcon.hasAttribute("data-mcx-native-rail-icon-hidden"),false);
  entry.select(true);controller.abort();assert.equal(home.children.length,1);assert.equal(home.getAttribute("aria-current"),"page");
});
test("native component icons reuse captured default SVG without invoking React components", () => {
  const adapter=createNativeRailAdapter(createCodexEnvironment()),node=new Node(),icon=new Node();
  icon.innerHTML="outline";adapter.remember(node,icon);icon.innerHTML="selected";
  assert.equal(adapter.icon(node,icon).innerHTML,"outline");
});

test("native icon factory creates default glyph through its explicit DOM API", () => {
  const document={};
  const adapter=vm.runInNewContext(`(${createNativeRailAdapter.toString()})`,{document})(createCodexEnvironment());
  const node=new Node(),current=new Node(),outline=new Node();
  node.setAttribute("data-sidebar-destination","builtin:scheduled");current.setAttribute("class","icon");
  const resource=()=>{throw new Error("must not invoke React component");};
  resource.createElement=(doc,className)=>{assert.equal(doc,document);assert.equal(className,"icon");return outline;};
  node.__reactFiber$test={memoizedProps:{item:{id:"builtin:scheduled",railIcons:{default:resource}}}};
  assert.equal(adapter.icon(node,current),outline);
});
