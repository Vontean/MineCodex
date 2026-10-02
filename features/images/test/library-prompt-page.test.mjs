import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createPageScriptSource } from "../src/library-prompt-source.mjs";
const source = await createPageScriptSource();
import { createCodexEnvironment } from "../../../packages/codex-adapter/src/renderer/environment.mjs";
const { libraryImage, promptFromConversation } = new Function("config", `${source.slice(0, source.indexOf('document.addEventListener("minecodex:image-prompt"'))}\nreturn {libraryImage, promptFromConversation};`)({codex:createCodexEnvironment()});
const file = { id: "libfile_a", file_id: "file_a", mime_type: "image/png", origination_message_id: "image", origination_thread_id: "thread" };

test("assembled Images installer owns each observer and cleans both enhancements exactly once",async()=>{
  const observers=[],listeners=new Set();
  class Observer {
    constructor(){this.observed=0;this.disconnected=0;observers.push(this);}
    observe(){this.observed++;}disconnect(){this.disconnected++;}
  }
  const document={body:{},documentElement:{lang:"en"},querySelectorAll:()=>[],
    addEventListener:(name,handler)=>listeners.add(handler),removeEventListener:(name,handler)=>listeners.delete(handler)};
  const controller=new AbortController();
  const cleanup=new Function("config","signal","document","MutationObserver","navigator",source)(
    {codex:{}},controller.signal,document,Observer,{language:"en"});
  await Promise.resolve();
  assert.equal(observers.length,3);assert.ok(observers.every(observer=>observer.observed===1));
  assert.equal(listeners.size,2);
  cleanup();controller.abort();cleanup();
  assert.ok(observers.every(observer=>observer.disconnected===1));assert.equal(listeners.size,0);
});
function conversation({ prompt = "exact prompt", role = "tool", asset = "sediment://file_a", generation = true } = {}) {
  return { mapping: {
    unrelated: { id: "unrelated", message: { author: { role: "user" }, content: { parts: ["wrong branch"] } } },
    user: { id: "user", message: { author: { role: "user" }, content: { parts: ["original", { content_type: "image_asset_pointer" }, "request"] } } },
    image: { id: "image", parent: "user", message: { author: { role }, content: { parts: [{ content_type: "image_asset_pointer", asset_pointer: asset, metadata: generation ? { dalle: { gen_id: "gen", prompt } } : {} }] } } },
  } };
}

test("only the exact generated asset supplies the prompt", () => {
  assert.deepEqual(promptFromConversation(file, conversation()), { text: "exact prompt", kind: "generation" });
  assert.equal(promptFromConversation(file, conversation({ asset: "sediment://file_b" })), null);
  assert.equal(promptFromConversation(file, conversation({ role: "user" })), null);
  assert.equal(promptFromConversation(file, conversation({ generation: false })), null);
  assert.equal(promptFromConversation({ ...file, origination_message_id: "missing" }, conversation()), null);
});

test("fallback is labelled as the original request and follows actual ancestry", () => {
  assert.deepEqual(promptFromConversation(file, conversation({ prompt: null })), { text: "original\nrequest", kind: "request" });
  const data = conversation({ prompt: " " });
  data.mapping.image.parent = "loop";
  data.mapping.loop = { id: "loop", parent: "loop" };
  assert.deepEqual(promptFromConversation(file, data), { text: null, kind: null });
  data.mapping.image.parent = "user";
  data.mapping.user.message.content.parts = [" "];
  assert.deepEqual(promptFromConversation(file, data), { text: null, kind: null });
});

test("viewer identity uses the full native Library record without leaking download URLs", () => {
  const header = { __reactFiber$test: { memoizedProps: { file: { id: file.id, mime_type: file.mime_type } }, return: { memoizedProps: { file: { ...file, thumbnail_url: "private", current_version_number: 2 } } } } };
  assert.deepEqual(libraryImage(header), { id: file.id, file_id: file.file_id, current_version_number: 2, origination_thread_id: "thread", origination_message_id: "image" });
  header.__reactFiber$test.memoizedProps.file = { ...file, mime_type: "application/pdf" };
  header.__reactFiber$test.return = null;
  assert.equal(libraryImage(header), null);
  assert.equal(libraryImage({}), null);
});

test("Images registers only a page script, with no Sites or standalone gallery entry", async () => {
  const manifest = JSON.parse(await readFile(new URL("../codex-feature.json", import.meta.url), "utf8"));
  assert.equal(manifest.entry.kind, "page-script");
  assert.equal(manifest.entry.script, "src/library-prompt-page.mjs");
  assert.equal(manifest.placement?.after, undefined);
  assert.equal(manifest.surfaceUrl, undefined);
  assert.equal(manifest.command, undefined);
});

test('native image toolbar ignores hidden zoom measurements and mounts in the Space viewport', async()=>{
  const {createLibraryViewerAdapter}=await import('../src/adapters/codex/library-viewer.mjs');
  const adapter=createLibraryViewerAdapter({});
  const trigger={},host={},group={},zoom={innerText:'72%',textContent:'25%50%100%150%200%72%',parentElement:{parentElement:group}};
  let embedded=true,overlay=false;
  const header={querySelector:()=>({closest:()=>trigger}),querySelectorAll:()=>[{innerText:'Share'},zoom],closest:selector=>selector.includes('.relative')?embedded?host:null:overlay?host:null};
  assert.deepEqual(adapter.toolbar(header),{zoom,group,host,trigger});
  embedded=false;overlay=true;assert.equal(adapter.toolbar(header).host,host);
  overlay=false;assert.equal(adapter.toolbar(header),null);
  embedded=true;zoom.innerText='Share';assert.equal(adapter.toolbar(header),null);
});

function viewerHarness(resolvePrompt) {
  function node(className = "") {
    return {className, children:[], style:{setProperty(){}}, dataset:{}, attributes:{}, isConnected:true,
      append(...children){this.children.push(...children);}, prepend(child){this.children.unshift(child);},
      replaceChildren(...children){this.children=children;}, setAttribute(key,value){this.attributes[key]=value;},
      addEventListener(key,fn){this[key]=fn;}, focus(){}, remove(){this.isConnected=false;}};
  }
  let ready=false,activeFile=file;
  const header={isConnected:true,getBoundingClientRect:()=>({width:800}),querySelectorAll:()=>[]};
  const trigger=node(),zoom=node(),host=node(),group=node();
  const scanSource=source.slice(source.lastIndexOf('async function scan()'),source.indexOf('function openPendingLocalPrompt()'));
  const harness=new Function('signal','document','libraryImage','libraryViewer','resolvePrompt','element','copyGlyph','label',
    `let scheduled=false,candidate=null,mounted=null;const PANEL_ID='panel';
    function unmount(){if(mounted){mounted.panel.remove();mounted=null;}}function syncMenu(){}function openPendingLocalPrompt(){}
    function showPrompt(r){r.panel.hidden=false;}function closePanel(r){r.panel.hidden=true;}
    ${scanSource};return {scan,record:()=>mounted,open:()=>showPrompt(mounted)};`)(
      new AbortController().signal,{querySelectorAll:()=>[header]},()=>activeFile,
      {toolbar:()=>ready?{zoom,host,group,trigger}:null},resolvePrompt,
      (tag,classes,text)=>Object.assign(node(classes),{tag,textContent:text}),()=>node(),en=>en);
  return {...harness,ready(value){ready=value;},file(value){activeFile=value;}};
}

test('delayed native toolbar can retry the same image instead of caching an unmountable candidate',async()=>{
  let requests=0;
  const harness=viewerHarness(async()=>{requests++;return null;});
  await harness.scan();assert.equal(requests,0);
  harness.ready(true);await harness.scan();assert.equal(requests,1);
  await harness.scan();assert.equal(requests,1);
  harness.ready(false);await harness.scan();
  harness.ready(true);await harness.scan();assert.equal(requests,2);
});

test('traceable image mounts before lookup finishes, then replaces skeleton and enables copy',async()=>{
  let finish;
  const harness=viewerHarness(()=>new Promise(resolve=>{finish=resolve;}));
  harness.ready(true);
  const pending=harness.scan();
  const record=harness.record();
  assert.ok(record.button.isConnected);
  assert.equal(record.state,'loading');
  assert.equal(record.copy.disabled,true);
  assert.equal(record.body.attributes['aria-busy'],'true');
  assert.equal(record.body.children[1].children.length,4);
  harness.open();assert.equal(record.panel.hidden,false);
  record.close.click();assert.equal(record.panel.hidden,true);
  finish({text:'resolved prompt',kind:'generation'});await pending;
  assert.equal(record.copy.disabled,false);
  assert.equal(record.body.attributes['aria-busy'],'false');
  assert.equal(record.body.children[0].textContent,'resolved prompt');
});

test('untraceable images have no entry; empty and failed lookups leave terminal states',async()=>{
  const noSource=viewerHarness(()=>assert.fail('must not fetch'));
  noSource.ready(true);noSource.file({...file,origination_thread_id:null});
  await noSource.scan();assert.equal(noSource.record(),null);
  let fail=true;
  const harness=viewerHarness(async()=>{if(fail)throw new Error('offline');return null;});
  harness.ready(true);await harness.scan();
  const record=harness.record();
  assert.equal(record.state,'error');assert.equal(record.copy.disabled,true);
  fail=false;await record.body.children[1].click();
  assert.equal(record.state,'empty');assert.equal(record.body.attributes['aria-busy'],'false');
});

test('late lookup from previous image cannot replace current image skeleton or content',async()=>{
  const completions=[];
  const harness=viewerHarness(()=>new Promise(resolve=>completions.push(resolve)));
  harness.ready(true);const first=harness.scan();
  harness.file({...file,id:'libfile_b',file_id:'file_b'});const second=harness.scan();
  const current=harness.record();
  completions[0]({text:'stale'});await first;
  assert.equal(current.state,'loading');
  completions[1]({text:'current'});await second;
  assert.equal(current.body.children[0].textContent,'current');
});

 test('viewer preserves distinguishable original-request fallback and prefers recorded generation text',async()=>{
  const resolveSource=source.slice(source.indexOf('async function resolvePrompt('),source.indexOf('function unmount()',source.indexOf('async function resolvePrompt(')));
  let data=conversation({prompt:null});
  const resolve=new Function('libraryApi','signal','promptFromConversation','config',`${resolveSource};return resolvePrompt;`)(
    {conversation:async()=>data},new AbortController().signal,promptFromConversation,{});
  assert.deepEqual(await resolve(file,new AbortController()),{text:'original\nrequest',kind:'request'});
  data=conversation();
  assert.deepEqual(await resolve(file,new AbortController()),{text:'exact prompt',kind:'generation'});
});

test('generation extraction uses exact-message async prompt and recorded image tool arguments',()=>{
  const data=conversation({prompt:null});
  data.mapping.image.message.metadata={async_task_prompt:'async generation'};
  assert.deepEqual(promptFromConversation(file,data),{text:'async generation',kind:'generation'});
  delete data.mapping.image.message.metadata;
  data.mapping.image.parent='call';
  data.mapping.call={id:'call',parent:'user',message:{author:{role:'assistant'},recipient:'image_gen.text2im',content:{content_type:'code',text:JSON.stringify({prompt:'tool generation'})}}};
  assert.deepEqual(promptFromConversation(file,data),{text:'tool generation',kind:'generation'});
  data.mapping.call.message.recipient='unrelated.tool';
  assert.deepEqual(promptFromConversation(file,data),{text:'original\nrequest',kind:'request'});
  data.mapping.call.message.recipient='image_gen.text2im';
  data.mapping.call.message.content.text='{"prompts":["first","second"]}';
  assert.deepEqual(promptFromConversation(file,data),{text:'original\nrequest',kind:'request'});
  data.mapping.call.message.content.text='{"prompt":"ambiguous multi-image"}';
  data.mapping.image.message.content.parts.push({...data.mapping.image.message.content.parts[0],asset_pointer:'sediment://file_b'});
  assert.notEqual(promptFromConversation(file,data)?.kind,'generation');
});

test('fallback body discloses missing generation prompt and labels the copied original request',async()=>{
  const harness=viewerHarness(async()=>({text:'original request',kind:'request'}));
  harness.ready(true);await harness.scan();const record=harness.record();
  assert.equal(record.state,'ready');assert.equal(record.copy.disabled,false);
  assert.match(record.body.children[0].textContent,/generation prompt is unavailable/);
  assert.equal(record.body.children[1].textContent,'Original request');
  assert.equal(record.body.children[2].textContent,'original request');
  assert.equal(record.copy.attributes['aria-label'],'Copy original request');
});

test('prompt menu requires the exact Library image and original message link',async()=>{
  const {createLibraryViewerAdapter}=await import('../src/adapters/codex/library-viewer.mjs');
  const oldDocument=globalThis.document,oldLocation=globalThis.location;
  let current=file,href='/c/thread?messageId=image';
  const original={getAttribute:()=>href};
  const menu={getBoundingClientRect:()=>({width:300}),querySelectorAll:()=>[original]};
  globalThis.document={querySelectorAll:()=>[menu]};globalThis.location={href:'https://chatgpt.com/'};
  try {
    const adapter=createLibraryViewerAdapter({currentFiber:()=>({memoizedProps:{file:current}})});
    assert.deepEqual(adapter.promptMenu(file),{menu,original});
    href='/c/thread?messageId=other';assert.equal(adapter.promptMenu(file),null);
    href='/c/thread?messageId=image';current={...file,id:'libfile_other'};
    assert.equal(adapter.promptMenu(file),null);
  } finally {globalThis.document=oldDocument;globalThis.location=oldLocation;}
});

test('local prompt lookup uses the indexed ID and never queries a cloud conversation',async()=>{
  const start=source.indexOf('async function resolvePrompt(');
  const resolveSource=source.slice(start,source.indexOf('function unmount()',start));
  const resolve=new Function('libraryApi','signal','promptFromConversation','config',`${resolveSource};return resolvePrompt;`)(
    {conversation:async()=>{throw Error('unexpected cloud lookup');}},new AbortController().signal,promptFromConversation,
    {requestHostAction:async(action,payload)=>{assert.equal(action,'local-image-source');assert.deepEqual(payload,{operation:'prompt',id:'exact'});return {text:'revised prompt',kind:'generation'};}});
  assert.deepEqual(await resolve({kind:'local',id:'exact'},new AbortController()),{text:'revised prompt',kind:'generation'});
});
