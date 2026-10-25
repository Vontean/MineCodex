import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createQuickChatSidebarAdapter,loadQuickChatSidebarIcon} from '../src/adapters/codex/sidebar.mjs';

test('sidebar entry belongs only to the visible native Codex New chat row',t=>{
  const previous=globalThis.document;
  t.after(()=>{globalThis.document=previous;});
  const slot={},svg={closest:()=>slot};
  const row=(mode,visible=true,animatedIcon='sidebar-new-chat')=>({mode,animatedIcon,parentElement:{},checkVisibility:()=>visible,querySelector:()=>svg});
  const hidden=row('codex',false),chat=row('chatgpt'),other=row('codex',true,'other'),codex=row('codex');
  const rows=[hidden,chat,other,codex];
  globalThis.document={querySelectorAll:()=>rows};
  const adapter=createQuickChatSidebarAdapter({props:(node,predicate)=>[
    {animatedIcon:node.animatedIcon,excludeFromNavigation:true},{sidebarMode:node.mode},
  ].find(predicate)});
  assert.equal(adapter.read().row,codex);
  assert.equal(adapter.read().slot,slot);
  rows.pop();assert.equal(adapter.read(),null);
});

test('Quick Chat icon follows the native Restore fallback import and rejects changed roles',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'mcx-qc-icon-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const url=name=>pathToFileURL(path.join(dir,name)).href;
  await writeFile(path.join(dir,'package.json'),'{"type":"module"}');
  await writeFile(path.join(dir,'app-initial-fixture.js'),'"./quick-chat-floating-surface-fixture.js"');
  const surface=path.join(dir,'quick-chat-floating-surface-fixture.js');
  await writeFile(surface,'import{icon as native}from"./icons.js";children:custom??(0,r.jsx)(native,{})');
  await writeFile(path.join(dir,'icons.js'),'export const icon={createElement(){return "native-quick-chat"}};');
  const previous=globalThis.document;
  globalThis.document={querySelectorAll:()=>[{src:url('app-initial-fixture.js')}]};
  t.after(()=>{globalThis.document=previous;});
  t.mock.method(globalThis,'fetch',async resource=>({text:()=>readFile(fileURLToPath(resource),'utf8')}));
  const icon=await loadQuickChatSidebarIcon(new AbortController().signal);
  assert.equal(icon.createElement(),'native-quick-chat');
  await writeFile(path.join(dir,'app-initial-fixture.js'),'"./floating-chat-surface-fixture.js"');
  await writeFile(path.join(dir,'floating-chat-surface-fixture.js'),await readFile(surface,'utf8'));
  assert.equal((await loadQuickChatSidebarIcon(new AbortController().signal)).createElement(),'native-quick-chat');
  await writeFile(path.join(dir,'app-initial-fixture.js'),'"./quick-chat-floating-surface-fixture.js"');
  await writeFile(surface,'import{icon as native}from"./icons.js";children:changedRole');
  await assert.rejects(loadQuickChatSidebarIcon(new AbortController().signal),/icon-contract/);
});
