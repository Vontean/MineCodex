import { load, JSON_SCHEMA } from 'js-yaml';

// Mermaid 11.12 的 getDiagramFromText 只转交显式 metadata，未转交预处理得到的标题。
// 使用相同的 YAML schema 与边界，避免另写只能识别单行标题的解析器。
export function readMermaidTitle(source) {
  const match = source.replace(/\r\n?/g, '\n').match(/^-{3}\s*[\n\r](.*?)[\n\r]-{3}\s*[\n\r]+/s);
  if (!match) return '';
  const metadata = load(match[1], { schema: JSON_SCHEMA });
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) && metadata.title
    ? String(metadata.title) : '';
}
