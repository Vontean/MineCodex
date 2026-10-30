import { findCodexModule } from '../../../packages/codex-adapter/src/renderer/modules.mjs';
import {readFile} from 'node:fs/promises';
import {loadComposerExpandControls,createComposerExpandAdapter} from './native.mjs';
import {composerCanExpand,installComposerExpand} from './install.mjs';
export async function createPageScriptSource(){
  return [findCodexModule, loadComposerExpandControls,createComposerExpandAdapter,composerCanExpand,installComposerExpand]
    .map(fn=>`const ${fn.name}=${fn.toString()};`).join('\n')+'\n'+await readFile(new URL('./entry.mjs',import.meta.url),'utf8');
}
