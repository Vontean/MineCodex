import test from 'node:test';
import assert from 'node:assert/strict';
import {codexModuleRegistry} from '../../../packages/codex-adapter/src/renderer/modules.mjs';
import {quickChatNativeCommand} from '../src/adapters/codex/shortcut.mjs';
import {loadRspackQuickChatBindings,loadRspackQuickChatIcon} from '../src/adapters/codex/rspack.mjs';

async function fixture(t) {
  const previous=globalThis.document;t.after(()=>globalThis.document=previous);
  globalThis.document={querySelectorAll:()=>[{src:'app://-/assets/123.hash.js'}]};
  const calls=[],session={},opened={},files={},product={},icon={createElement(){}};
  const source=`function lifecycle(e,t,r){r.d(t,{aa:()=>launch,bb:()=>fresh,cc:()=>opened,dd:()=>session,ee:()=>shut});var x=r("drafts"),y=r("text");const marker="has-opened-quick-chat-v1";function launch(s,opts={}){if(!s.get(cap,{name:"chatgpt.quick-chat"}).isCapable)return;let current=s.get(session),p=s.get(page);null!=p?restore(s,p.hasConversation):null==current?fresh(s,opts):s.get(opened)||(restore(s,current.hasConversation))}function fresh(){}function discard(s){let c=s.get(session);shut(s),s.set(session,null),null!=c&&((0,x.save)(s,{draftKey:c.conversationId,content:null}),(0,y.clear)(s,c.conversationId,""),s.set(y.files,c.conversationId,[]),destroy(s,c))}function shut(){}}`;
  const factory=Function(`return (${source})`)();
  const functionOf=name=>Function(`return (${source.match(new RegExp('function '+name+'\\([^]*?(?=function |}$)'))[0]})`)();
  const runtime=()=>{throw Error('Must not execute native factories')};
  runtime.m={life:factory,catalog:()=>{},surface:Function('return function surface(e,t,r){var glyph=r("icons");return {"data-floating-chat-surface":true,minimizedIcon:custom,children:custom??(0,jsx.jsx)(glyph.bubble,{})}}')(),mode:Function('return function mode(){const conversationDetailMode="";return true?"work":"codex"}')()};
  runtime.c={life:{exports:{aa:functionOf('launch'),bb:()=>calls.push(['create']),cc:opened,dd:session,ee:()=>calls.push(['close']),discard:functionOf('discard')}},drafts:{exports:{save:(_,value)=>calls.push(['draft',value])}},text:{exports:{clear:(_,id,text)=>calls.push(['text',id,text]),files}},icons:{exports:{bubble:icon}},mode:{exports:{renamed:product}}};
  runtime.m.catalog=Function('return function catalog(){return [{id:"newTask",titleIntlId:"codex.command.newThread"},{id:"temporaryChat",titleIntlId:"codex.command.temporaryChat"}]}')();
  const registry=await codexModuleRegistry({read:async()=> 'export{r as __webpack_require__}',load:async()=>({__webpack_require__:runtime})});
  const writes=[],current={conversationId:'current',hasConversation:true};
  const scope={get:key=>key===session?current:key===opened?true:key===product?'codex':null,set:(...args)=>writes.push(args)};
  return {registry,runtime,calls,writes,scope,files,current,icon};
}

test('Rspack discovers renamed lifecycle roles and closes only the matching draft without destroying the session',async t=>{
  const f=await fixture(t),b=loadRspackQuickChatBindings(f.registry,quickChatNativeCommand);
  assert.equal(b.native,false);assert.equal(b.isOpen(f.scope),true);assert.equal(b.mode(f.scope),'codex');
  b.create(f.scope);assert.equal(b.close(f.scope,'other'),false);assert.equal(b.close(f.scope,'current'),true);
  assert.deepEqual(f.calls,[['create'],['draft',{draftKey:'current',content:null}],['text','current',''],['close']]);
  assert.deepEqual(f.writes,[[f.files,'current',[]]]);
  assert.equal(loadRspackQuickChatIcon(f.registry),f.icon);
});

test('official command restoration yields before lifecycle discovery; malformed and ambiguous catalogs fail',async t=>{
  const f=await fixture(t);
  const native={...f.registry,module:()=>({source:'{id:"newTask",titleIntlId:"codex.command.newThread"},{id:"temporaryChat",titleIntlId:"codex.command.temporaryChat"},{id:"quickChat",titleIntlId:"codex.command.quickChat"}'})};
  assert.deepEqual(loadRspackQuickChatBindings(native,quickChatNativeCommand),{native:true});
  assert.throws(()=>loadRspackQuickChatBindings({...native,module:()=>({source:'unrelated'})},quickChatNativeCommand),/catalog/);
  f.registry.entries.push({...f.registry.entries.find(e=>e.id==='catalog'),id:'duplicate'});
  assert.throws(()=>loadRspackQuickChatBindings(f.registry,quickChatNativeCommand),/contract changed/);
});

test('missing close and hidden-sidebar mode roles do not disable opening; changed icon never substitutes a guessed glyph',async t=>{
  const f=await fixture(t);delete f.runtime.c.life.exports.discard;f.registry.entries.splice(f.registry.entries.findIndex(e=>e.id==='mode'),1);
  const b=loadRspackQuickChatBindings(f.registry,quickChatNativeCommand);
  assert.equal(typeof b.create,'function');assert.equal(b.close,undefined);assert.equal(b.mode,undefined);
  f.registry.entries.find(e=>e.id==='surface').source='"data-floating-chat-surface":true,minimizedIcon:custom,children:changed';
  assert.throws(()=>loadRspackQuickChatIcon(f.registry),/icon-contract/);
});
