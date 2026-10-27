import { saveQvDiagram } from '../../mermaid/export.mjs';

// 图表下载协议只由实验性功能加载，阅读增强不依赖此能力。
export async function loadNativeMermaidActions(native, {read = async url => { const response = await fetch(url); if (!response.ok) throw new Error('native-diagram-source-unavailable'); return response.text(); }, load = url => import(url)} = {}) {
  const url = [...document.querySelectorAll('link[rel="modulepreload"],script[src]')]
    .map(node => node.href || node.src).find(url => /\/app-initial-[^/]+\.js/.test(url));
  const source = await read(url);
  const section = marker => {
    const at = source.indexOf(marker);
    if (at < 0) throw new Error('native-diagram-contract-changed');
    return source.slice(source.lastIndexOf('function ', at), source.indexOf('function ', at));
  };
  const preview = section('id:`imagePreviewDialog.label`');
  const downloadSection = preview.slice(preview.indexOf('suggestedFilename:', preview.indexOf('downloadSrc:')));
  const downloadIcon = downloadSection.match(/children:\(0,[\w$]+\.jsx\)\(([\w$]+),\{className:`icon-xs`\}/)?.[1];
  const download = section('Failed to download image');
  const downloadName = download.match(/^function ([\w$]+)\(/)?.[1];
  const requestName = download.match(/await ([\w$]+)\(`save-file`,/)?.[1];
  const imports = new Map();
  for (const match of source.matchAll(/import\{([^}]+)\}from["']([^"']+)["']/g))
    for (const entry of match[1].split(',')) {
      const parts = entry.trim().split(/\s+as\s+/);
      imports.set(parts.at(-1), { name:parts[0], url:new URL(match[2],url).href });
    }
  const binding = async name => {
    const alias = markdownExportAlias(source, name);
    if (alias) return (await load(url))[alias];
    const item = imports.get(name);
    if (!item) throw new Error('native-diagram-save-request-unavailable');
    return (await load(item.url))[item.name];
  };
  // 新版原生下载使用 workspaceFiles.saveStream，沿用原生字节流与保存动作。
  if (download.includes('workspaceFiles.saveStream')) {
    const [DownloadIcon, downloadImage] = await Promise.all([binding(downloadIcon), binding(downloadName)]);
    if (typeof DownloadIcon !== 'function' || typeof downloadImage !== 'function') throw new Error('native-diagram-download-unavailable');
    return {...native, DownloadIcon, downloadImage};
  }
  const [DownloadIcon, saveFile] = await Promise.all([binding(downloadIcon),binding(requestName)]);
  return { ...native, DownloadIcon, downloadImage({downloadSrc,suggestedFilename}) {
    return saveQvDiagram(downloadSrc,saveFile,markdownDownloadsDirectory,suggestedFilename);
  } };
}
