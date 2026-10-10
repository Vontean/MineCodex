import test from 'node:test';
import assert from 'node:assert/strict';
import {quickChatOpenExport,installQuickChatShortcut} from '../src/adapters/codex/shortcut.mjs';
import {createPageScriptSource} from '../src/injection-source.mjs';

const source = 'function renamed(s,opts={}){if(!s.get(cap,{name:`chatgpt.quick-chat`}).isCapable)return;let current=s.get(session),page=s.get(pageSession);if(page!=null)return;open(s)}export{renamed as opener}';
test('finds the native open role across renamed locals and fails on a changed contract',()=>{
  assert.equal(quickChatOpenExport(source),'opener');
  assert.equal(quickChatOpenExport(source.replaceAll('renamed','other').replace('opener','newExport')),'newExport');
  assert.throws(()=>quickChatOpenExport(source.replace('chatgpt.quick-chat','other')));
  assert.throws(()=>quickChatOpenExport(source.replace('export{renamed as opener}','export{}')));
});
function fixture({mode='codex',native=false,scopeAvailable=true,minimized=false,active=false,hidden=false,visible=true}={}) {
  const previous=globalThis.document,listeners=new Set(),calls=[];
  const button={checkVisibility:()=>true};
  const restored=[];
  const editable={checkVisibility:()=>visible,focus:()=>restored.push('focus')};
  const surface={closest:()=>hidden?{}:null,querySelector:()=>editable};
  const restoreButton={checkVisibility:()=>true,click:()=>restored.push('restore')};
  const floating={isMinimized:true,unifiedDocking:true,onMinimizedChange:()=>{},onPresentationChange:()=>{}};
  const restoreProps={size:'composer',uniform:true,onClick:()=>{},onKeyDown:()=>{},onPointerDown:()=>{},onPointerEnter:()=>{}};
  const scope={get:()=>{},set:()=>{},scope:{__scopeBrand:'AppScope'}};
  const fiber={memoizedState:{memoizedState:{current:scopeAvailable?scope:null}}};
  globalThis.document={querySelectorAll:selector=>selector==='button'?(minimized?[restoreButton]:[]):selector==='[data-floating-chat-surface]'?(active?[surface]:[]):[button],addEventListener:(name,fn)=>listeners.add(fn),removeEventListener:(name,fn)=>listeners.delete(fn)};
  const controller=new AbortController();
  const codex={props:(node,predicate)=>node===surface?{...floating,isMinimized:false}:node===restoreButton?[restoreProps,floating].find(predicate):({mode,onModeSelect:()=>{}}),currentFiber:()=>fiber,report:()=>{}};
  const shortcut=installQuickChatShortcut(controller.signal,codex,async()=>({native,open:value=>calls.push(value)}));
  const key=(overrides={})=>{
    const event={code:'KeyN',metaKey:true,altKey:true,ctrlKey:false,shiftKey:false,repeat:false,isComposing:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},stopPropagation(){this.stopped=true},...overrides};
    for(const fn of listeners)fn(event);return event;
  };
  return {shortcut,controller,calls,key,listeners,restored,restore:()=>{shortcut.dispose();globalThis.document=previous}};
}
test('Codex Cmd Option N invokes the native action once and retains its scope',async()=>{
  const f=fixture();try {await f.shortcut.ready;const e=f.key();assert.equal(f.calls.length,1);assert.equal(e.defaultPrevented,true);assert.equal(e.stopped,true);}finally{f.restore()}
});
test('Temporary Chat, repeats, composition and already-handled shortcuts remain native',async()=>{
  const f=fixture();try {await f.shortcut.ready;for(const overrides of [{shiftKey:true,altKey:false},{repeat:true},{isComposing:true},{defaultPrevented:true},{metaKey:false},{code:'KeyM'}])f.key(overrides);assert.equal(f.calls.length,0);}finally{f.restore()}
});
test('Work mode, restored native command and missing scope never consume the shortcut',async()=>{
  for(const options of [{mode:'work'},{native:true},{scopeAvailable:false}]){const f=fixture(options);try{await f.shortcut.ready;assert.equal(f.key().defaultPrevented,false);assert.equal(f.calls.length,0);}finally{f.restore()}}
});
test('unload and abort remove the listener; late discovery cannot revive it',async()=>{
  const f=fixture();try{f.shortcut.dispose();await f.shortcut.ready;assert.equal(f.listeners.size,0);f.key();assert.equal(f.calls.length,0)}finally{f.restore()}
  const g=fixture();try{await g.shortcut.ready;g.controller.abort();assert.equal(g.listeners.size,0);g.key();assert.equal(g.calls.length,0)}finally{g.restore()}
});
test('serialized installer includes shortcut dependencies',async()=>{
  const source=await createPageScriptSource();
  assert.doesNotThrow(()=>new Function('signal','config',source));
});

test('page Quick Chat restores through its native button in Work and Codex without opening a second chat',async()=>{
  for(const mode of ['work','codex']) {const f=fixture({mode,minimized:true,scopeAvailable:false});try{await f.shortcut.ready;assert.equal(f.key().defaultPrevented,true);assert.deepEqual(f.restored,['restore']);assert.equal(f.calls.length,0);f.shortcut.dispose();f.key();assert.deepEqual(f.restored,['restore']);}finally{f.restore()}}
});

test('active page composer is focused without changing presentation or opening a chat',async()=>{
  const f=fixture({mode:'work',active:true});try{await f.shortcut.ready;assert.equal(f.key().defaultPrevented,true);assert.deepEqual(f.restored,['focus']);assert.equal(f.calls.length,0);}finally{f.restore()}
});
test('hidden and invisible page composers cannot steal focus',async()=>{
  for(const options of [{hidden:true},{visible:false}]){const f=fixture({mode:'work',active:true,...options});try{await f.shortcut.ready;assert.equal(f.key().defaultPrevented,false);assert.deepEqual(f.restored,[]);}finally{f.restore()}}
});
