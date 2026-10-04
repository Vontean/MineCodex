// 输入只有正文与排除区间；编号规则不依赖 Codex 语法树、DOM 或编辑器。
export function collectMarkdownFootnotes(text, excludedRanges) {
  let offset = 0;
  const lines = text.split('\n').map((value) => {
    const line = { text: value, from: offset, to: offset + value.length };
    offset = line.to + 1;
    return line;
  });
  const excluded = (position) => excludedRanges.some(([from, to]) => position >= from && position < to);
  const definitions = new Map();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const match = line.text.match(/^ {0,3}\[\^([^\]]+)\]:\s*(.*)$/);
    if (!match || excluded(line.from)) continue;
    const body = [match[2]];
    let end = index;
    while (end + 1 < lines.length && /^(?: {4}|\t)/.test(lines[end + 1].text)) {
      end++;
      body.push(lines[end].text.replace(/^(?: {4}|\t)/, ''));
    }
    definitions.set(match[1], {
      from: line.from,
      to: lines[end].to,
      body: body.join('\n'),
      refs: [],
      number: 0,
    });
    index = end;
  }
  const notes = [...definitions.values()];
  const references = [];
  let number = 0;
  for (const match of text.matchAll(/\[\^([^\]\n]+)\]/g)) {
    const escaped = (text.slice(0, match.index).match(/\\+$/)?.[0].length || 0) % 2;
    const note = definitions.get(match[1]);
    if (
      escaped ||
      !note ||
      excluded(match.index) ||
      notes.some((note) => match.index >= note.from && match.index < note.to)
    )
      continue;
    if (!note.number) note.number = ++number;
    note.refs.push(match.index);
    references.push({
      id: match[1],
      from: match.index,
      to: match.index + match[0].length,
      number: note.number,
      definitionFrom: note.from,
    });
  }
  // 没有引用的定义仍保留，沿用正文末尾的连续编号。
  for (const note of notes) if (!note.number) note.number = ++number;
  return { definitions, references };
}
