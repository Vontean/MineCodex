import assert from 'node:assert/strict';
import test from 'node:test';
import { nearbyRadarDetails } from '../src/mermaid/detail-position.mjs';

test('radar details keep nearby choices instead of an empty far corner', () => {
  const near={distance:16,pointer:0,selected:120},local={distance:32,pointer:0,selected:60},far={distance:560,pointer:0,selected:0};
  assert.deepEqual(nearbyRadarDetails([near,local,far]),[near,local]);
});
test('pointer clearance wins and constrained edges retain a usable local choice', () => {
  const covered={distance:0,coversPointer:true},edge={distance:48,coversPointer:false},adjacent={distance:60,coversPointer:false},far={distance:200,coversPointer:false};
  assert.deepEqual(nearbyRadarDetails([covered,edge,adjacent,far]),[edge,adjacent]);
  assert.deepEqual(nearbyRadarDetails([covered]),[covered]);
});
