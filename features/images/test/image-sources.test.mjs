import test from "node:test";
import assert from "node:assert/strict";
import {createImageSourcesAdapter} from "../src/adapters/codex/image-sources.mjs";

function fixture({variant = "browse", tabs = [{key:"generated"}, {key:"uploaded"}], content = {}, injected = false} = {}) {
  const search = {};
  const shell = {querySelector:() => search};
  const navigation = {nextElementSibling:content, parentElement:shell};
  const node = {closest:() => injected ? {} : null, parentElement:{parentElement:navigation}};
  const props = {variant, tabs, selectedKey:"uploaded"};
  return {node, props, search, navigation, shell, content};
}

test("image navigation requires both native source keys and ignores plugin-owned tablists", () => {
  const previous = globalThis.document;
  const unrelated = fixture({tabs:[{key:"generated"}]});
  const clone = fixture({injected:true});
  const native = fixture();
  const entries = [unrelated, clone, native];
  globalThis.document = {querySelectorAll:() => entries.map(entry => entry.node)};
  const adapter = createImageSourcesAdapter({props(node, predicate) {
    const props = entries.find(entry => entry.node === node)?.props;
    return predicate(props) ? props : null;
  }});
  try {
    const result = adapter.read();
    assert.equal(result.tabs, native.node);
    assert.equal(result.content, native.content);
    assert.equal(result.search, native.search);
    assert.equal(result.selectedKey, "uploaded");
    entries.pop();
    assert.equal(adapter.read(), null);
  } finally {globalThis.document = previous;}
});

test("a changed native content boundary fails closed", () => {
  const previous = globalThis.document;
  const entry = fixture({content:null});
  globalThis.document = {querySelectorAll:() => [entry.node]};
  try {
    const adapter = createImageSourcesAdapter({props:(_node, predicate) => predicate(entry.props) ? entry.props : null});
    assert.equal(adapter.read(), null);
  } finally {globalThis.document = previous;}
});


test("26.1007 inset wrappers preserve the actual gallery and search boundary", context => {
  const previous=globalThis.document;
  context.after(()=>{globalThis.document=previous;});
  const entry=fixture();
  const toolbar=entry.navigation;
  const inset={parentElement:entry.shell,nextElementSibling:entry.content};
  toolbar.nextElementSibling=null;
  toolbar.parentElement={parentElement:inset};
  globalThis.document={querySelectorAll:()=>[entry.node]};
  const adapter=createImageSourcesAdapter({props:(_node,predicate)=>predicate(entry.props)?entry.props:null});
  const result=adapter.read();
  assert.equal(result.navigation,inset);
  assert.equal(result.content,entry.content);
  assert.equal(result.search,entry.search);
});
