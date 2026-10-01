import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { createUIInstallerSource } from "../src/install.mjs";

class Node extends EventTarget {
  style = {};
  attributes = new Map();
  children = [];
  setAttribute(name, value) { this.attributes.set(name, value); }
  append(...nodes) { this.children.push(...nodes); }
  remove() { this.removed = true; }
}

test("serialized shared shell preserves content and callbacks and releases its stylesheet", () => {
  const document = { head:new Node(), createElement:()=>new Node(), addEventListener:()=>{} };
  const window = { addEventListener:()=>{} };
  const controller = new AbortController();
  // 验证实际注入形式，不依赖模块闭包。
  const install = vm.runInNewContext(`(${createUIInstallerSource()})`, { document, window, AbortController, clearTimeout, cancelAnimationFrame:()=>{} });
  const ui = install(controller.signal);
  const dialog = new Node(), back = new Node(), content = new Node();
  const unsafeTitle = '<img src=x onerror="alert(1)">';
  let closed = 0;
  const heading = ui.heading(dialog, { title:unsafeTitle, closeLabel:"关闭", onClose:()=>closed++, back });
  dialog.append(content);
  assert.equal(dialog.attributes.get("data-mcx-ui-surface"), "dialog");
  assert.equal(heading.children[0], back);
  assert.equal(heading.children[1].textContent, unsafeTitle);
  assert.equal(heading.children[1].innerHTML, undefined);
  const close = dialog.children[1];
  assert.equal(close.type, "button");
  assert.equal(close.attributes.get("aria-label"), "关闭");
  close.dispatchEvent(new Event("click"));
  assert.equal(closed, 1);
  assert.equal(dialog.children[2], content);
  const footer = ui.footer(new Node()), save = ui.action(new Node(), "primary");
  footer.append(save);
  assert.equal(save.attributes.get("data-mcx-ui-action"), "primary");
  assert.equal(document.head.children.length, 5);
  controller.abort();
  assert.ok(document.head.children.every(node => node.removed));
  assert.equal(content.removed, undefined);
});
