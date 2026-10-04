import assert from 'node:assert/strict';
import test from 'node:test';
import { fileNavigationPath, selectFileNavigationDirectory } from '../src/domain/navigation.mjs';

test('compact path preserves filename and parent, with all ancestor columns reachable', () => {
  assert.deepEqual(fileNavigationPath('Project', 'README.md'), { labels: ['Project', 'README.md'], directories: [''] });
  assert.deepEqual(fileNavigationPath('Project', 'docs/readme.md').labels, ['Project', 'docs', 'readme.md']);
  const result = fileNavigationPath('Project', 'docs/a/b/文件.md');
  assert.deepEqual(result.labels, ['…', 'b', '文件.md']);
  assert.deepEqual(result.directories, ['', 'docs', 'docs/a', 'docs/a/b']);
});
test('choosing a sibling discards the abandoned branch without changing earlier columns', () => {
  const before = ['', 'docs', 'docs/a', 'docs/a/b'];
  assert.deepEqual(selectFileNavigationDirectory(before, 1, 'docs/c'), ['', 'docs', 'docs/c']);
  assert.deepEqual(before, ['', 'docs', 'docs/a', 'docs/a/b']);
});
