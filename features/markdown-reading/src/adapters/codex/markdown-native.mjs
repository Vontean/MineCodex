// 消息流 Markdown 解析与展示组件的原生契约，供表格预览和富文本共用。
export async function loadNativeMarkdownRenderer(source, url, module) {
  const exported = source.slice(source.lastIndexOf('export{'));
  const binding = (name) =>
    module[exported.match(new RegExp(`\\b${name.replace(/\$/g, '\\$')} as ([\\w$]+)`))?.[1]];
  const at = source.indexOf('getDefaultComponents:r,...n');
  const wrapper = source.slice(source.lastIndexOf('function ', at), source.indexOf('function ', at));
  const markdownName = wrapper.match(/^function ([\w$]+)/)?.[1];
  const after = source.slice(source.indexOf(wrapper) + wrapper.length);
  const init = after.match(/^function ([\w$]+)\(\)/)?.[1];
  const initializer = [
    ...source.matchAll(/function ([\w$]+)\(\)\{return\(\1=[\w$]+\(\(\(\)=>\{([^}]{0,1600})\}\)\)\)\(\)\}/g),
  ].find((m) => m[2].includes(`${init}()`) && binding(m[1]));
  if (!initializer || !binding(markdownName)) throw new Error('native-rich-markdown-contract-unavailable');
  binding(initializer[1])();
  let lexer, sharedUrl;
  const lexerName = source.match(/tokens:([\w$]+)\(e,void 0\)/)?.[1];
  for (const m of source.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g))
    for (const entry of m[1].split(',')) {
      const parts = entry.trim().split(/\s+as\s+/);
      if (parts.at(-1) === lexerName) {
        sharedUrl = new URL(m[2], url).href;
        lexer = (await import(sharedUrl))[parts[0]];
      }
    }
  if (!sharedUrl || typeof lexer !== 'function') throw new Error('native-markdown-lexer-unavailable');
  return { Markdown: binding(markdownName), lexer, sharedUrl };
}
