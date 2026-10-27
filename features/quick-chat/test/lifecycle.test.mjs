import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {installQuickChatShortcut} from '../src/adapters/codex/shortcut.mjs';
import {quickChatLifecycleActions} from '../src/adapters/codex/lifecycle.mjs';

const source=`export const calls=[];
const opened={},session={},page={},attachments={};
function open(s,opts={}){if(!s.get(cap,{name:\`chatgpt.quick-chat\`}).isCapable)return;let current=s.get(session),other=s.get(page);if(other!=null)return;if(current==null){fresh(s,opts);return}s.get(opened)||(restore(s))}
function fresh(s){calls.push(['new',s])}
function close(s){s.set(opened,false);calls.push(['close'])}
function draft(s,value){calls.push(['draft',value])}
function text(s,id,value){calls.push(['text',id,value])}
function discard(s){if(s.get(page)!=null){close(s),s.set(page,null);return}let t=s.get(session);close(s),s.set(session,null),t!=null&&(draft(s,{draftKey:t.conversationId,content:null}),text(s,t.conversationId,\`\`),s.set(attachments,t.conversationId,[]),t.hasConversation&&destroy(s,t.conversationId),cleanup(s,t))}
const atom=(scope,read)=>({read});
const mode=atom(session,({get:s})=>{let t=setting(s,preferences.conversationDetailMode);return s(role)===\`STEPS_PROSE\`?\`work\`:\`codex\`});
function commands(){return [{id:\`newTask\`,titleIntlId:\`codex.command.newThread\`},{id:\`temporaryChat\`,titleIntlId:\`codex.command.temporaryChat\`}];}
export{open as opener,fresh as creator,opened as active,session as current,page as contextual,close as closer,draft as draftAction,text as textAction,attachments as files,mode as product};`;

test('native lifecycle discovery follows roles rather than minified names',()=>{
  assert.deepEqual(quickChatLifecycleActions(source),{session:'current',close:'closer',draft:'draftAction',text:'textAction',attachments:'files',mode:'product'});
  assert.deepEqual(quickChatLifecycleActions(source.replaceAll('discard','renamedDiscard').replaceAll('attachments','renamedFiles')),quickChatLifecycleActions(source));
});

test('native close clears only the current chat draft and attachments without destroying its running session',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'mcx-close-'));
  const previous={document:globalThis.document,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),fetch:globalThis.fetch};
  let shortcut;
  try {
    await writeFile(join(dir,'package.json'),'{"type":"module"}');
    const file=join(dir,'app-initial-test.js');await writeFile(file,source);
    const url=pathToFileURL(file).href;
    const native=await import(url),session={conversationId:'chat',hasConversation:true};
    const writes=[];
    const scope={scope:{__scopeBrand:'AppScope'},get:token=>token===native.current?session:token===native.product?'codex':true,set:(...args)=>writes.push(args)};
    const surface={};
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{platform:'MacIntel'}});
    globalThis.document={querySelectorAll:selector=>selector==='link[rel="modulepreload"],script[src]'?[{src:url}]:[],addEventListener(){},removeEventListener(){}};
    globalThis.fetch=async resource=>({text:()=>readFile(fileURLToPath(resource),'utf8')});
    shortcut=installQuickChatShortcut(new AbortController().signal,{report(){},currentFiber:()=>({memoizedState:{memoizedState:{current:scope}}})});
    await shortcut.ready;
    assert.equal(shortcut.canClose(),true);
    assert.equal(shortcut.close(surface,'other-chat'),false);
    assert.deepEqual(native.calls,[]);
    assert.equal(shortcut.close(surface,'chat'),true);
    assert.deepEqual(native.calls,[['draft',{draftKey:'chat',content:null}],['text','chat',''],['close']]);
    assert.deepEqual(writes,[[native.files,'chat',[]],[native.active,false]]);
    assert.equal(scope.get(native.current),session);
    shortcut.dispose();assert.equal(shortcut.close(surface,'chat'),false);
  } finally {
    shortcut?.dispose();globalThis.document=previous.document;globalThis.fetch=previous.fetch;
    if(previous.navigator)Object.defineProperty(globalThis,'navigator',previous.navigator);else delete globalThis.navigator;
    await rm(dir,{recursive:true,force:true});
  }
});
