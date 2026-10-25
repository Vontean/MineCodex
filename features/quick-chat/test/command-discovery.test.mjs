import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {installQuickChatShortcut} from '../src/adapters/codex/shortcut.mjs';

test('loader follows the shared command catalog and yields to a restored native Quick Chat command',async t=>{
  const previousDocument=globalThis.document,previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  t.after(()=>{globalThis.document=previousDocument;if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator;});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{platform:'Win32'}});
  t.mock.method(globalThis,'fetch',async url=>({ok:true,text:()=>readFile(fileURLToPath(url),'utf8')}));
  for(const native of [false,true]){
    const dir=await mkdtemp(join(tmpdir(),'mcx-command-'));
    const abort=new AbortController();
    try{
      const url=pathToFileURL(join(dir,'app-initial-fixture.js')).href;
      await writeFile(join(dir,'app-initial-fixture.js'),'import "./app-shared-fixture.js";function open(s,opts={}){if(!s.get(cap,{name:`chatgpt.quick-chat`}).isCapable)return;let current=s.get(session),page=s.get(pageSession);if(page!=null)return;if(current==null){fresh(s,opts);return}s.get(active)||(restore(s))}function fresh(s,opts){}const active={};export{open as opener,fresh as newChat,active as opened}');
      await writeFile(join(dir,'app-shared-fixture.js'),'const commands=[{id:`newTask`,titleIntlId:`codex.command.newThread`},{id:`temporaryChat`,titleIntlId:`codex.command.temporaryChat`}'+(native?',{id:`quickChat`,titleIntlId:`codex.command.quickChat`}':'')+'];');
      globalThis.document={querySelectorAll:()=>[{src:url}],addEventListener(){},removeEventListener(){}};
      const reports=[];
      const shortcut=installQuickChatShortcut(abort.signal,{report:(...args)=>reports.push(args)});
      await shortcut.ready;
      assert.deepEqual(reports.at(-1),['quick-chat-shortcut',true]);
      assert.equal(shortcut.available(),!native);
      await writeFile(join(dir,'app-shared-fixture.js'),'const commands=[{id:`unrelated`,titleIntlId:`codex.command.other`}];');
      const invalid=installQuickChatShortcut(abort.signal,{report:(...args)=>reports.push(args)});
      await invalid.ready;
      assert.equal(invalid.available(),false);
      assert.deepEqual(reports.at(-1),['quick-chat-shortcut',false,'quick-chat-command-catalog-unavailable']);
    }finally{abort.abort();await rm(dir,{recursive:true,force:true});}
  }
});
