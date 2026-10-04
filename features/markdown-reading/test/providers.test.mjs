import assert from 'node:assert/strict';
import test from 'node:test';
import { captureMarkdownProviders } from '../src/adapters/codex/providers.mjs';

test('added roots inherit the nearest committed provider once, with original nesting', () => {
  const context = {},
    outer = {};
  const provider = (type, value, parent) => ({ tag: 10, type, memoizedProps: { value }, return: parent });
  const fiber = provider(context, 'nearest', provider(context, 'ignored', provider(outer, 'outer', null)));
  const parent = {},
    element = { parentElement: parent };
  const wrap = captureMarkdownProviders(element, {
    currentFiber: (node) => (node === parent ? fiber : null),
  });
  const React = { createElement: (type, props, children) => ({ type, ...props, children }) };
  assert.deepEqual(wrap(React, 'content'), {
    type: outer,
    value: 'outer',
    children: { type: context, value: 'nearest', children: 'content' },
  });
});
