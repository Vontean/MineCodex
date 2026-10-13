import test from "node:test";
import assert from "node:assert/strict";
import {createImageSourcesAdapter} from "../src/adapters/codex/image-sources.mjs";

function fixture({variant = "browse", tabs = [{key:"generated"}, {key:"uploaded"}], content = {}, injected = false} = {}) {
  const search = {};
  const shell = {querySelector:() => search};
  const navigation = {nextElementSibling:content, parentElement:shell};
  const node = {isConnected:true,getBoundingClientRect:()=>({width:100,height:36}),closest:() => injected ? {} : null, parentElement:{parentElement:navigation}};
  if (content) Object.assign(content,{isConnected:true,getBoundingClientRect:()=>({width:100,height:100})});
  const props = {variant, tabs, selectedKey:"uploaded"};
  return {node, props, search, navigation, shell, content};
}
function environment(entries, plan="pro") {
  const rail={},location=plan==="plus"?{pathname:"/library",search:"?tab=images"}:{pathname:"/space/files",search:"?tab=images"};
  return {rail:()=>rail,account:()=>({read:()=>({status:"available",planType:plan,key:"current"})}),props(node,predicate){
    const props=node===rail?{router:{state:{location}}}:entries.find(entry=>entry.node===node)?.props;
    return predicate(props)?props:null;
  }};
}

test("image navigation requires both native source keys and ignores plugin-owned tablists", () => {
  const previous = globalThis.document;
  const unrelated = fixture({tabs:[{key:"generated"}]});
  const clone = fixture({injected:true});
  const native = fixture();
  const entries = [unrelated, clone, native];
  globalThis.document = {querySelectorAll:() => entries.map(entry => entry.node)};
  const adapter = createImageSourcesAdapter(environment(entries));
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
    const adapter = createImageSourcesAdapter(environment([entry]));
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
  const adapter=createImageSourcesAdapter(environment([entry]));
  const result=adapter.read();
  assert.equal(result.navigation,inset);
  assert.equal(result.content,entry.content);
  assert.equal(result.search,entry.search);
});

test("Plus uses the visible Library navigation and preserves its native content boundary",context=>{
  const previous=globalThis.document;context.after(()=>{globalThis.document=previous;});
  const entry=fixture({tabs:[{key:"suggested"},{key:"images"},{key:"folders"},{key:"all"}]});
  entry.node.parentElement=entry.navigation;entry.props.selectedKey="images";
  const hidden=fixture({tabs:entry.props.tabs});hidden.node.getBoundingClientRect=()=>({width:0,height:0});
  globalThis.document={querySelectorAll:()=>[hidden.node,entry.node]};
  const adapter=createImageSourcesAdapter(environment([hidden,entry],"plus"));
  const result=adapter.read();assert.equal(result.tabs,entry.node);assert.equal(result.content,entry.content);assert.equal(result.mode,"library");
  assert.equal(createImageSourcesAdapter(environment([entry],"pro")).read(),null);
  // 注入主动隐藏原生标签和图库后，仍能找到本次挂载；隐藏缓存页仍被排除。
  const replacement={isConnected:true,getBoundingClientRect:()=>({width:100,height:36})};
  entry.node.hidden=true;entry.node.getBoundingClientRect=()=>({width:0,height:0});entry.navigation.querySelector=()=>replacement;
  entry.content.hidden=true;entry.content.getBoundingClientRect=()=>({width:0,height:0});
  entry.content.nextElementSibling={...replacement,id:"minecodex-image-gen-content"};
  assert.equal(adapter.read().content,entry.content);
});
