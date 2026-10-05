import assert from 'node:assert/strict';
import test from 'node:test';
import { collectMarkdownFootnotes } from '../src/domain/footnotes.mjs';

test('first reference determines numbering, repeats share it, unused definitions remain visible', () => {
  const text = 'B[^b] A[^a] B[^b]\n\n[^a]: first\n[^b]: second\n[^c]: unused';
  const result = collectMarkdownFootnotes(text, []);
  assert.deepEqual(
    result.references.map(({ id, number }) => [id, number]),
    [
      ['b', 1],
      ['a', 2],
      ['b', 1],
    ],
  );
  assert.deepEqual(
    [...result.definitions].map(([id, note]) => [id, note.number]),
    [
      ['a', 2],
      ['b', 1],
      ['c', 3],
    ],
  );
  for (const reference of result.references) {
    assert.equal(text.slice(reference.from, reference.to), `[^${reference.id}]`);
    assert.equal(reference.definitionFrom, result.definitions.get(reference.id).from);
  }
});

test('escaped, unknown, code and definition references never consume a number', () => {
  const text =
    '\\[^a] [^unknown] `[^a]`\n[^fake]: code\n[^b] [^a]\n[^a]: text [^b]\n    continued\n\tlast\n[^b]: other';
  const excluded = [
    [text.indexOf('`'), text.indexOf('`') + 6],
    [text.indexOf('[^fake]'), text.indexOf('[^b]')],
  ];
  const result = collectMarkdownFootnotes(text, excluded);
  assert.deepEqual(
    result.references.map(({ id, number }) => [id, number]),
    [
      ['b', 1],
      ['a', 2],
    ],
  );
  assert.equal(result.definitions.has('fake'), false);
  assert.equal(result.definitions.get('a').body, 'text [^b]\ncontinued\nlast');
});

test('an even escape prefix preserves a reference', () => {
  const text = '\\\\[^a]\n[^a]: body';
  const result = collectMarkdownFootnotes(text, []);
  assert.equal(result.references.length, 1);
  assert.equal(result.references[0].number, 1);
});

test('all duplicate definition ranges stay outside references while the last body wins', () => {
  const text = 'first[^a]\n[^a]: earlier [^b]\n    continuation [^a]\nagain[^a]\n[^a]: latest\n[^b]: other';
  const result = collectMarkdownFootnotes(text, []);
  assert.deepEqual(result.references.map(({ id }) => id), ['a', 'a']);
  assert.equal(result.definitions.get('a').body, 'latest');
  assert.deepEqual(result.definitionRanges.map(({ id }) => id), ['a', 'a', 'b']);
  assert.equal(text.slice(result.definitionRanges[0].from, result.definitionRanges[0].to),
    '[^a]: earlier [^b]\n    continuation [^a]');
  assert.ok(result.references.every(ref => ref.definitionFrom === text.indexOf('[^a]: latest')));
});
