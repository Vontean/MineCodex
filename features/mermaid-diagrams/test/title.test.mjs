import assert from 'node:assert/strict';
import test from 'node:test';
import { readMermaidTitle } from '../src/mermaid/qv-title.mjs';

test('frontmatter titles follow Mermaid YAML boundaries and JSON schema', () => {
  assert.equal(readMermaidTitle('---\ntitle: "雷达: 候选对比"\n---\nradar-beta'),'雷达: 候选对比');
  assert.equal(readMermaidTitle('---\r\ntitle: >-\r\n  第一行\r\n  第二行\r\n---\r\nsankey-beta'),'第一行 第二行');
  assert.equal(readMermaidTitle('---\nconfig:\n  theme: dark\n---\nsankey-beta'),'');
  assert.equal(readMermaidTitle('radar-beta\n%% title: 不是元数据'),'');
  assert.equal(readMermaidTitle('---\n- title\n---\nradar-beta'),'');
  assert.throws(()=>readMermaidTitle('---\ntitle: [\n---\nradar-beta'));
});
