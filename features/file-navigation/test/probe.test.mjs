import assert from 'node:assert/strict';
import test from 'node:test';
import {hasNativeFilesAnchor} from '../src/probe.mjs';

test('Files probe is not applicable before the native tree is mounted', () => {
  assert.equal(hasNativeFilesAnchor({querySelector:()=>null}), false);
  assert.equal(hasNativeFilesAnchor({querySelector:()=>({checkVisibility:()=>false})}), false);
  assert.equal(hasNativeFilesAnchor({querySelector:()=>({checkVisibility:()=>true})}), true);
});

test('Files probe accepts visible tree anchors without checkVisibility', () => {
  assert.equal(hasNativeFilesAnchor({querySelector:()=>({})}), true);
});
