import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createUIInstallerSource } from "../src/install.mjs";

class Node extends EventTarget {
  attributes = new Map(); style = {}; children = [];
  setAttribute(name, value) { this.attributes.set(name, value); }
  append(...nodes) { this.children.push(...nodes); }
  remove() { this.removed = true; }
}
function fixture(t) {
  const document = new EventTarget();
  Object.assign(document, {head:new Node(),body:new Node(),createElement:()=>new Node()});
  const window = new EventTarget(), controller = new AbortController();
  const install = vm.runInNewContext(`(${createUIInstallerSource()})`, {
    document, window, AbortController, clearTimeout, cancelAnimationFrame:()=>{},
    getComputedStyle:()=>({zoom:"2"}),
  });
  const ui = install(controller.signal,{codex:{},themeTokens:[],themeTokenAliases:{},themeBindings:{}});
  t.after(()=>controller.abort());
  return {ui,document};
}
test("surface selection keeps composer, dropdown, popover and dialog roles distinct", t => {
  const {ui} = fixture(t);
  for (const [kind, variant] of [["dialog","opaque"],["dropdown","menu"],["popover","opaque"],["composer-menu","floating"]]) {
    const node = ui.surface(new Node(), kind);
    assert.equal(node.attributes.get("data-mcx-ui-surface"), kind);
    assert.equal(node.attributes.get("data-mcx-ui-variant"), variant);
  }
  const translucent = ui.surface(new Node(), "popover", {opaque:false});
  assert.equal(translucent.attributes.get("data-mcx-ui-variant"), "translucent");
  const page = ui.page(new Node());
  assert.equal(page.attributes.get("data-mcx-ui-layer"), "page");
  assert.equal(page.attributes.get("data-mcx-ui-variant"), "opaque");
  const defaultDialog = ui.surface(new Node(), "dialog", {variant:"default"});
  assert.equal(defaultDialog.attributes.get("data-mcx-ui-variant"), "default");
});
test("composer menu uses body coordinates and zoom independently of outer stacks", t => {
  const {ui} = fixture(t), panel = new Node();
  const anchor = {closest:selector=>{
    if (selector !== "[data-composer-body]") return null;
    return {getBoundingClientRect:()=>({left:100,top:600,width:720})};
  }};
  ui.composerMenu(panel,anchor);
  assert.deepEqual(panel.style,{left:"50px",top:"298px",transform:"translateY(-100%)",width:"360px",maxHeight:"292px"});
});
test("floating panel adds material without taking over native geometry or layers", t => {
  const {ui} = fixture(t), panel = new Node();
  panel.style = {zIndex:"-1",borderRadius:"24px",position:"absolute"};
  ui.surface(panel,"floating-panel");
  assert.equal(panel.attributes.get("data-mcx-ui-variant"),"opaque");
  assert.equal(panel.attributes.has("data-mcx-ui-layer"),false);
  assert.deepEqual(panel.style,{zIndex:"-1",borderRadius:"24px",position:"absolute"});
});
test("modal focus wraps, gives child popups priority, and stops when disposed", t => {
  const {ui,document} = fixture(t);
  const focus = [];
  const controls = ["first","last"].map(name=>({closest:()=>null,getClientRects:()=>[{}],focus:()=>focus.push(name)}));
  const modal = {querySelectorAll:()=>controls,focus:()=>focus.push("container")};
  let blocked=false, closed=0;
  const stop = ui.trapFocus(()=>modal,{onClose:()=>closed++,isBlocked:()=>blocked});
  function press(key, shiftKey=false) {
    const event = new Event("keydown",{cancelable:true});
    Object.assign(event,{key,shiftKey}); document.dispatchEvent(event); return event.defaultPrevented;
  }
  document.activeElement=controls[0];
  assert.equal(press("Tab",true),true); assert.deepEqual(focus,["last"]);
  document.activeElement=controls[1]; press("Tab"); assert.deepEqual(focus,["last","first"]);
  blocked=true; press("Escape"); assert.equal(closed,0);
  blocked=false; press("Escape"); assert.equal(closed,1);
  stop(); press("Escape"); assert.equal(closed,1);
});
