import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {quickChatOpenExport,quickChatLifecycleExports,quickChatNativeCommand,installQuickChatShortcut} from '../src/adapters/codex/shortcut.mjs';
import {createPageScriptSource} from '../src/injection-source.mjs';

const source = 'function renamed(s,opts={}){if(!s.get(cap,{name:`chatgpt.quick-chat`}).isCapable)return;let current=s.get(session),page=s.get(pageSession);if(page!=null)return;open(s)}export{renamed as opener}';
test('finds the native open role across renamed locals and fails on a changed contract',()=>{
  assert.equal(quickChatOpenExport(source),'opener');
  assert.equal(quickChatOpenExport(source.replaceAll('renamed','other').replace('opener','newExport')),'newExport');
  assert.throws(()=>quickChatOpenExport(source.replace('chatgpt.quick-chat','other')));
  assert.throws(()=>quickChatOpenExport(source.replace('export{renamed as opener}','export{}')));
});
test('command definitions remain discoverable before lazy catalog initialization',()=>{
  const definitions='function init(){return(init=once(()=>{commands=[{id:`newTask`,titleIntlId:`codex.command.newThread`},{id:`temporaryChat`,titleIntlId:`codex.command.temporaryChat`}]}))()}export{commands as catalog}';
  assert.equal(quickChatNativeCommand(definitions),false);
  assert.equal(quickChatNativeCommand(definitions.replace('commands=[','commands=[{id:`quickChat`,titleIntlId:`codex.command.quickChat`},')),true);
  assert.equal(quickChatNativeCommand(definitions+';other={id:`quickChat`}'),false);
  assert.throws(()=>quickChatNativeCommand(definitions.replace('temporaryChat','other')),/command-catalog/);
});
function fixture({platform='MacIntel',mode='codex',native=false,scopeAvailable=true,minimized=false,active=false,hidden=false,visible=true,open=true,assetUrl=null}={}) {
  const previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{platform}});
  const previous=globalThis.document,listeners=new Set(),calls=[];
  const button={checkVisibility:()=>true};
  const restored=[],created=[],reports=[];
  let opened=open,surfaceSession="existing";
  const editable={checkVisibility:()=>visible,focus:()=>restored.push('focus')};
  const surface={closest:()=>hidden?{}:null,querySelector:()=>editable};
  const restoreButton={checkVisibility:()=>true,click:()=>restored.push('restore')};
  const floating={isMinimized:true,unifiedDocking:true,onMinimizedChange:()=>{},onPresentationChange:()=>{}};
  const restoreProps={size:'composer',uniform:true,onClick:()=>{},onKeyDown:()=>{},onPointerDown:()=>{},onPointerEnter:()=>{}};
  const scope={get:()=>{},set:()=>{},scope:{__scopeBrand:'AppScope'}};
  const fiber={memoizedState:{memoizedState:{current:scopeAvailable?scope:null}}};
  globalThis.document={querySelectorAll:selector=>selector==='link[rel="modulepreload"],script[src]'?[{src:assetUrl}]:selector==='button'?(minimized?[restoreButton]:[]):selector==='[data-floating-chat-surface]'?(active?[surface]:[]):[button],addEventListener:(name,fn)=>listeners.add(fn),removeEventListener:(name,fn)=>listeners.delete(fn)};
  const controller=new AbortController();
  const codex={props:(node,predicate)=>node===surface?[{...floating,isMinimized:false},{session:{conversationId:surfaceSession}}].find(predicate):node===restoreButton?[restoreProps,floating].find(predicate):({mode,onModeSelect:()=>{}}),currentFiber:()=>fiber,report:(...args)=>reports.push(args)};
  const shortcut=installQuickChatShortcut(controller.signal,codex,assetUrl?null:async()=>({native,open:value=>calls.push(value),create:value=>{created.push(value);opened=true},isOpen:()=>opened}));
  const key=(overrides={})=>{
    const event={code:'KeyN',metaKey:true,altKey:true,ctrlKey:false,shiftKey:false,repeat:false,isComposing:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},stopPropagation(){this.stopped=true},...overrides};
    for(const fn of listeners)fn(event);return event;
  };
  return {shortcut,controller,calls,key,listeners,restored,created,reports,setSession:id=>{surfaceSession=id},restore:()=>{shortcut.dispose();globalThis.document=previous;if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator;}};
}

test('default loader initializes with a lazy undefined catalog and exported native actions',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'mcx-shortcut-'));
  const previousFetch=globalThis.fetch;
  const source='let commands;function init(){commands=[{id:`newTask`,titleIntlId:`codex.command.newThread`},{id:`temporaryChat`,titleIntlId:`codex.command.temporaryChat`}]}function open(s,opts={}){if(!s.get(cap,{name:`chatgpt.quick-chat`}).isCapable)return;let current=s.get(session),page=s.get(pageSession);if(page!=null)return;if(current==null){fresh(s,opts);return}s.get(active)||(restore(s))}function fresh(s,opts){}const active={};export{commands as catalog,open as opener,fresh as newChat,active as opened}';
  let f;
  try{
    const path=join(dir,'app-initial-fixture.js');await writeFile(path,source);
    globalThis.fetch=async()=>({text:async()=>source});
    f=fixture({assetUrl:pathToFileURL(path).href});await f.shortcut.ready;
    assert.deepEqual(f.reports,[['quick-chat-shortcut',true]]);
  }finally{f?.restore();globalThis.fetch=previousFetch;await rm(dir,{recursive:true,force:true});}
});

test('Windows Ctrl Alt N opens Quick Chat and rejects Meta, extra modifiers and invalid input states',async()=>{
  const f=fixture({platform:'Win32'});
  try {
    await f.shortcut.ready;
    assert.equal(f.key().defaultPrevented,false);
    const win={ctrlKey:true,metaKey:false};
    for(const overrides of [{metaKey:true},{shiftKey:true},{altKey:false},{repeat:true},{isComposing:true},{defaultPrevented:true},{code:'KeyM'}])f.key({...win,...overrides});
    assert.equal(f.calls.length,0);
    const event=f.key(win);assert.equal(event.defaultPrevented,true);assert.equal(f.calls.length,1);
  } finally {f.restore();}
});
test('Codex Cmd Option N invokes the native action once and retains its scope',async()=>{
  const f=fixture();try {await f.shortcut.ready;const e=f.key();assert.equal(f.calls.length,1);assert.equal(e.defaultPrevented,true);assert.equal(e.stopped,true);}finally{f.restore()}
});
test('Windows Ctrl Alt N opens and creates Quick Chat in ChatGPT mode',async()=>{
  for(const open of [true,false]){const f=fixture({platform:'Win32',mode:'chatgpt',open});try{await f.shortcut.ready;assert.equal(f.key({ctrlKey:true,metaKey:false}).defaultPrevented,true);assert.equal(f.calls.length,open?1:0);assert.equal(f.created.length,open?0:1);}finally{f.restore()}}
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


test('fully closed Quick Chat creates a fresh session, including retained exit DOM',async()=>{
  for(const options of [{},{active:true},{minimized:true}]) {
    const f=fixture({...options,open:false});
    try{await f.shortcut.ready;assert.equal(f.key().defaultPrevented,true);assert.equal(f.created.length,1);assert.equal(f.calls.length,0);assert.deepEqual(f.restored,[]);}finally{f.restore();}
  }
});

test('open and minimized sessions are retained rather than recreated',async()=>{
  for(const options of [{active:true},{minimized:true}]) {
    const f=fixture({...options,open:true});
    try{await f.shortcut.ready;f.key();assert.equal(f.created.length,0);assert.equal(f.calls.length,0);assert.equal(f.restored.length,1);}finally{f.restore();}
  }
});

test('native lifecycle roles follow renamed open, new-chat and boolean-state exports',()=>{
  const source='function open(s,opts={}){if(!s.get(cap,{name:`chatgpt.quick-chat`}).isCapable)return;let current=s.get(session),page=s.get(pageSession);if(page!=null)return;if(current==null){fresh(s,opts);return}s.get(active)||(restore(s))}function fresh(s,opts){}export{open as opener,fresh as newChat,active as opened}';
  assert.deepEqual(quickChatLifecycleExports(source),{open:'opener',create:'newChat',openState:'opened'});
  assert.deepEqual(quickChatLifecycleExports(source.replaceAll('fresh','renamed').replaceAll('active','renamedState')),{open:'opener',create:'newChat',openState:'opened'});
  assert.throws(()=>quickChatLifecycleExports(source.replace('active as opened','other as opened')),/lifecycle-contract/);
});


test('fresh composer focuses only after the new native session mounts, and abort cancels focus',async()=>{
 for(const abort of [false,true]) {
  const f=fixture({active:true,open:false});
  try{await f.shortcut.ready;f.key();assert.deepEqual(f.restored,[]);if(abort)f.controller.abort();f.setSession('fresh');f.shortcut.sync();assert.deepEqual(f.restored,abort?[]:['focus']);}finally{f.restore()}
 }
});
