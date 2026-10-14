import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownExportAlias } from '../../../packages/codex-adapter/src/markdown/block-actions.mjs';
import { createPageScriptSource } from '../src/injection-source.mjs';

test('native export names match exactly, including dollar signs and prefix collisions', () => {
  const source = 'export{other$Yc as wrong,$Yc as Table,Yc as Plain,wrap$ as Wrap,Direct}';
  assert.equal(markdownExportAlias(source, '$Yc'), 'Table');
  assert.equal(markdownExportAlias(source, 'Yc'), 'Plain');
  assert.equal(markdownExportAlias(source, 'wrap$'), 'Wrap');
  assert.equal(markdownExportAlias(source, 'Direct'), 'Direct');
  assert.equal(markdownExportAlias(source, 'missing'), undefined);
  assert.equal(markdownExportAlias('no export', 'missing'), undefined);
});

test('serialized reading installer includes the export resolver', async () => {
  const source = await createPageScriptSource();
  assert.doesNotThrow(() => new Function('config', 'signal', source));
  const declarations = source.slice(0, source.indexOf('const marker ='));
  const resolve = new Function(`${declarations}; return markdownExportAlias;`)();
  assert.equal(resolve('export{$Yc as Table}', '$Yc'), 'Table');
});
