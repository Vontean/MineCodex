import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createPageScriptSource } from '../src/injection-source.mjs';
import { createPageScriptSource as readerSource } from '../../markdown-reading/src/injection-source.mjs';
import { discoverFeatures, selectEnabledFeatures } from '../../../packages/runtime-host/src/feature-registry.mjs';
import { normalizeConfig } from '../../../packages/cli/src/config.mjs';
import { fileURLToPath } from 'node:url';

test('default runtime selects reading without any diagram source or assets',async()=>{
  const features=await discoverFeatures(fileURLToPath(new URL('../../../features/',import.meta.url)));
  const config=normalizeConfig({features:{'markdown-reading':true}});
  const enabled=Object.entries(config.features).filter(([,on])=>on).map(([id])=>id).join(',');
  const selected=selectEnabledFeatures(features,enabled);
  assert.ok(selected.some(item=>item.id==='markdown-reading'));
  assert.ok(!selected.some(item=>item.id==='mermaid-diagrams'));
  const manifest=JSON.parse(await readFile(new URL('../../markdown-reading/codex-feature.json',import.meta.url),'utf8'));
  assert.deepEqual(Object.keys(manifest.entry.resources),['styles']);
  assert.doesNotMatch(await readerSource(),/createQvResources|installMarkdownMermaid|saveQvDiagram/);
});
test('serialized diagram installer runs without module scope and releases styles and observer',async()=>{
  const styles=new Set();let observer,probe;
  const source=await createPageScriptSource();
  const dispose=runInNewContext(`(function(config){${source}})(config)`,{
    document:{body:{},head:{append:node=>{node.isConnected=true;styles.add(node)}},
      createElement:()=>({setAttribute(){},remove(){styles.delete(this)}}),querySelectorAll:()=>[]},
    window:{requestAnimationFrame(){return 1},cancelAnimationFrame(){}},
    MutationObserver:class {constructor(){observer=this}observe(){this.connected=true}disconnect(){this.connected=false}},
    config:{resources:{mermaidStyles:'diagram-css',qvLoadingStyles:'loading-css'},codex:{report(){}},registerSelfCheck:check=>probe=check},
  });
  assert.equal(styles.size,1);assert.equal(probe().state,'not-applicable');
  dispose();assert.equal(styles.size,0);assert.equal(observer.connected,false);
});
