import { findCodexModule } from '../../../../../packages/codex-adapter/src/renderer/modules.mjs';
import { saveQvDiagram } from '../../mermaid/export.mjs';

// 图表下载协议只由图表功能加载，阅读增强不依赖此能力。
export async function loadNativeMermaidActions(native, {read = async url => { const response = await fetch(url); if (!response.ok) throw new Error('native-diagram-source-unavailable'); return response.text(); }, load = url => import(url)} = {}) {
  if (native.rspack) return loadRspackMermaidActions(native);
  const url = await findCodexModule('app-initial',{read});
  if (!url) throw new Error('native-diagram-module-unavailable');
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


export function loadRspackMermaidActions(native) {
  const registry=native.rspack;
  const preview=registry.module(source=>source.includes('imagePreviewDialog.label')&&source.includes('suggestedFilename:')&&source.includes('downloadSrc:'),'diagram preview download');
  const call=preview.source.match(/\(0,([\w$]+\.[\w$]+)\)\(\{downloadSrc:[^}]*suggestedFilename:/);
  const icon=call&&preview.source.slice(call.index).match(/children:\(0,[\w$]+\.jsx\)\(([\w$]+\.[\w$]+),\{className:"icon-xs"\}/)?.[1];
  // 新版原生图标通过组件 + asset 绘制，沿真实下载按钮读取两者。
  const assetIcon=call&&preview.source.slice(call.index).match(/children:\(0,[\w$]+\.jsx\)\(([\w$]+\.[\w$]+),\{"aria-hidden":!1,asset:([\w$]+\.[\w$]+)\}/);
  if (!call || (!icon && !assetIcon)) throw new Error('native-diagram-download-unavailable');
  const downloadImage=registry.binding(preview,call[1]);
  let DownloadIcon;
  if(icon) DownloadIcon=registry.binding(preview,icon);
  else {
    const Icon=registry.binding(preview,assetIcon[1]),asset=registry.binding(preview,assetIcon[2]);
    if(typeof Icon!=='function'||!asset||!native.React?.createElement) throw new Error('native-diagram-download-unavailable');
    DownloadIcon=props=>native.React.createElement(Icon,{...props,asset});
  }
  if (typeof DownloadIcon!=='function' || typeof downloadImage!=='function'
    || !String(downloadImage).includes('workspaceFiles.saveStream')
    || !String(downloadImage).includes('Failed to download image')) throw new Error('native-diagram-download-unavailable');
  return {...native,DownloadIcon,downloadImage};
}
