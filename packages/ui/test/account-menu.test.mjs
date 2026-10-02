import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeAccountMenuAdapter } from '../src/native/account-menu.mjs';
import { createCodexEnvironment } from '../../codex-adapter/src/renderer/environment.mjs';

test('account menu anchor uses committed profile callbacks instead of translated labels',()=>{
  const saved=globalThis.document, codex=createCodexEnvironment();let visible=true,closed=0;
  const click=()=>{};const profile={onOpenSettings:click,settingsShortcut:'⌘,'};const owner={open:true,onClose:()=>closed++};
  const settings={querySelector:()=>({children:[{querySelector:()=>({})},{},{}]}),__reactFiber$test:{memoizedProps:{onClick:click},return:{memoizedProps:profile,return:{memoizedProps:owner}}}};
  const unrelated={querySelector:settings.querySelector,__reactFiber$test:{memoizedProps:{onClick:()=>{}},return:{memoizedProps:profile}}};
  const menu={checkVisibility:()=>visible,querySelectorAll:()=>[unrelated,settings]};
  try {
    globalThis.document={querySelectorAll:()=>[menu]};const adapter=createNativeAccountMenuAdapter(codex);const found=adapter.settings();assert.equal(found.item,settings);found.close();assert.equal(closed,1);
    visible=false;assert.equal(adapter.settings(),null);
    visible=true;delete profile.settingsShortcut;assert.equal(adapter.settings(),null);
  } finally {globalThis.document=saved;}
});
