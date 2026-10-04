import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverFeatures} from '../src/feature-registry.mjs';
import {fileURLToPath} from 'node:url';

test('all registered adapter factories produce self-contained page-script function bodies',async()=>{
  const features=await discoverFeatures(fileURLToPath(new URL('../../../features/',import.meta.url)));
  assert.equal(features.length,9);
  assert.equal(features.some(feature=>feature.id==='unread-inbox'),false);
  for(const feature of features) {
    if(feature.entry.kind!=='page-script')continue;
    assert.equal(typeof feature.pageScript.source,'string',feature.id);
    assert.doesNotThrow(()=>new Function('signal','config',feature.pageScript.source),feature.id);
    assert.doesNotMatch(feature.pageScript.source,/^import\s/m,feature.id);
  }
});
