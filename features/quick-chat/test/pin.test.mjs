import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuickChatPinAdapter} from '../src/adapters/codex/pin.mjs';
import {installQuickChatPin} from '../src/frontend/pin.mjs';

function context({mode='codex',hasConversation=true,work=false,widget=false,annotation=false,history=false,minimized=false,exiting=false}={}) {
  const previous=globalThis.document,layer={closest:()=>null},anchor={},editable={},picker={checkVisibility:()=>true};
  const surface={closest:()=>layer,querySelector:selector=>selector.startsWith('header')?anchor:editable};
  const values=new Map([[picker,[{mode,onModeSelect(){}}]],[editable,[{conversationId:'one',isWorkConversation:work,isWidgetOverlay:widget,annotationSubmitTarget:annotation}]],
    [surface,[{name:'QuickChatWindow'},{isPresent:!exiting,onExitComplete(){}},{session:{conversationId:'one',hasConversation}},
      {onMinimizedChange(){},onPresentationChange(){},renderMenu(){},presentation:'expanded',isMinimized:minimized,renderTranscript:()=>history?{props:{conversations:[],onNewChat(){},onConversationSelect(){}}}:null}]]]);
  globalThis.document={querySelectorAll:s=>s.startsWith('button')?[picker]:[surface]};
  return {adapter:createQuickChatPinAdapter({props:(node,predicate)=>values.get(node)?.find(predicate)}),restore:()=>{globalThis.document=previous}};
}
test('Pin only applies to an existing classic chat in Codex; empty history, Work and widgets are excluded',()=>{
  for(const options of [{mode:'work'},{hasConversation:false,history:true},{work:true},{widget:true},{annotation:true},{exiting:true}]){
    const f=context(options);try{assert.deepEqual(f.adapter.surfaces(),[])}finally{f.restore()}
  }
  const f=context();try{assert.equal(f.adapter.surfaces()[0].showPin,true)}finally{f.restore()}
});
test('history hides Pin while minimized chat remains identifiable for unpinning',()=>{
  for(const options of [{history:true},{minimized:true}]){const f=context(options);try{const snapshot=f.adapter.surfaces()[0];assert.equal(snapshot.showPin,false);assert.equal(snapshot.sessionId,'one');assert.equal(snapshot.minimized,!!options.minimized)}finally{f.restore()}}
});

class Node {
  attrs=new Map();className='';isConnected=false;parentElement=null;
  setAttribute(k,v){this.attrs.set(k,String(v))} getAttribute(k){return this.attrs.get(k)??null} hasAttribute(k){return this.attrs.has(k)} removeAttribute(k){this.attrs.delete(k)}
  set innerHTML(value){this.svg=new Node();this.path=new Node()}
  querySelector(selector){return selector==='svg'?this.svg:this.path}
  addEventListener(name,fn){(this.events??=new Map()).set(name,fn)}
  contains(node){return node===this}
  click(){this.events.get('click')({stopPropagation(){}})}
  remove(){this.isConnected=false}
  before(node){node.isConnected=true;node.parentElement=this.parentElement}
}
function uiFixture() {
  const previous={document:globalThis.document,adapter:globalThis.createQuickChatPinAdapter};
  const controller=new AbortController(),layer=new Node(),anchor=new Node(),events=new Map(),buttons=[];
  anchor.className='native-button';anchor.parentElement={};anchor.svg=new Node();anchor.svg.setAttribute('width','16');anchor.svg.setAttribute('height','16');
  let rows=[{sessionId:'one',layer,anchor,showPin:true,expanded:true,minimized:false,history:false,expand:()=>{rows[0].expanded=true;rows[0].showPin=true}}];
  globalThis.createQuickChatPinAdapter=()=>({surfaces:()=>rows});
  globalThis.document={documentElement:{lang:'en'},head:{append:()=>{}},createElement:tag=>{const n=new Node();if(tag==='button')buttons.push(n);return n},addEventListener:(k,f)=>events.set(k,f),removeEventListener:k=>events.delete(k)};
  const pin=installQuickChatPin(controller.signal,{codex:{},resources:{pin:'<svg/>'}});pin.sync();
  return {pin,layer,buttons,events,get rows(){return rows},set rows(value){rows=value},restore(){pin.dispose();controller.abort();globalThis.document=previous.document;globalThis.createQuickChatPinAdapter=previous.adapter}};
}
test('Pin keeps the chat expanded, Minimize unpins, and restore stays unpinned',()=>{
  const f=uiFixture();try{
    f.buttons[0].click();assert.equal(f.layer.hasAttribute('data-mcx-quick-chat-pinned-layer'),true);assert.equal(f.buttons[0].getAttribute('aria-pressed'),'true');
    f.rows[0].expanded=false;f.rows[0].showPin=false;f.pin.sync();assert.equal(f.rows[0].expanded,true);
    f.rows[0].minimized=true;f.rows[0].showPin=false;f.pin.sync();assert.equal(f.layer.hasAttribute('data-mcx-quick-chat-pinned-layer'),false);
    f.rows[0].minimized=false;f.rows[0].showPin=true;f.pin.sync();assert.equal(f.buttons.at(-1).getAttribute('aria-pressed'),'false');
  }finally{f.restore()}
});
test('session switch, Escape and unload clear Pin without blocking native keyboard events',()=>{
  const f=uiFixture();try{
    f.buttons[0].click();f.rows[0].sessionId='two';f.pin.sync();assert.equal(f.layer.hasAttribute('data-mcx-quick-chat-pinned-layer'),false);
    f.buttons.at(-1).click();f.events.get('keydown')({key:'Escape',target:{}});assert.equal(f.layer.hasAttribute('data-mcx-quick-chat-pinned-layer'),true);f.events.get('keydown')({key:'Escape',target:f.layer});assert.equal(f.layer.hasAttribute('data-mcx-quick-chat-pinned-layer'),false);
    f.buttons.at(-1).click();f.pin.dispose();assert.equal(f.layer.hasAttribute('data-mcx-quick-chat-pinned-layer'),false);assert.equal(f.buttons.at(-1).isConnected,false);assert.equal(f.events.size,0);
  }finally{f.restore()}
});

test('history preview releases a previously pinned content window',()=>{
  const f=uiFixture();try{f.buttons[0].click();f.rows[0].history=true;f.rows[0].showPin=false;f.pin.sync();assert.equal(f.layer.hasAttribute('data-mcx-quick-chat-pinned-layer'),false);assert.equal(f.buttons[0].isConnected,false);}finally{f.restore()}
});
