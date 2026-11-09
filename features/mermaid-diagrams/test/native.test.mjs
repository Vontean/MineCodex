import {findCodexModule} from '../../../packages/codex-adapter/src/renderer/modules.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loadNativeMermaidActions} from '../src/adapters/codex/native.mjs';
import {markdownExportAlias} from '../../../packages/codex-adapter/src/markdown/block-actions.mjs';
import {saveQvDiagram} from '../src/mermaid/export.mjs';

for (const renamed of [false,true]) test(`native stream download uses current exported roles${renamed?' after renaming':''}`,async()=>{
  let source='import{icon as iconLocal}from"./icons.js";function preview(){id:`imagePreviewDialog.label`;downloadSrc:blob,suggestedFilename:name,children:(0,R.jsx)(iconLocal,{className:`icon-xs`})}function next(){}function downloadLocal({downloadSrc}){await host.workspaceFiles.saveStream({source:downloadSrc});Failed to download image}function end(){}export{downloadLocal as D}';
  if(renamed)source=source.replaceAll('downloadLocal','renamed$Download').replaceAll('iconLocal','renamed$Icon');
  const calls=[],downloadImage=payload=>{calls.push(payload);return true;},Icon=()=>{};
  const load=async url=>url.endsWith('icons.js')?{icon:Icon}:{D:downloadImage};
  const context=vm.createContext({URL,document:{querySelectorAll:()=>[{href:'file:///assets/app-initial-current.js'}]},markdownExportAlias,saveQvDiagram});
  const loader=vm.runInContext(`const findCodexModule=${findCodexModule};(${loadNativeMermaidActions})`,context);
  const native=await loader({Button:'button'},{read:async()=>source,load});
  assert.equal(native.DownloadIcon,Icon);assert.equal(native.Button,'button');
  const blob=new Blob(['png']);assert.equal(await native.downloadImage({downloadSrc:blob,suggestedFilename:'mermaid-diagram.png'}),true);
  assert.equal(calls[0].downloadSrc,blob);
  await assert.rejects(loader({},{read:async()=>source.replace('downloadLocal as D','missing as D').replace('renamed$Download as D','missing as D'),load}),/unavailable/);
});

for (const renamed of [false,true]) test(`Rspack diagram actions follow preview dependencies${renamed?' with renamed bindings':''}`,async()=>{
  let source='function preview(){id:"imagePreviewDialog.label";onClick:()=>{(0,files.download)({downloadSrc:blob,suggestedFilename:name})},children:(0,R.jsx)(glyph.Download,{className:"icon-xs"})}';
  if(renamed)source=source.replaceAll('files.download','renamed$.stream').replaceAll('glyph.Download','other$.Icon');
  const calls=[],DownloadIcon=()=>{};
  const downloadImage=payload=>{const protocol='workspaceFiles.saveStream',failure='Failed to download image';calls.push(payload);return protocol&&failure&&true;};
  const refs=[];
  const rspack={module:(predicate)=>{assert.equal(predicate(source),true);return {source};},binding:(_entry,ref)=>{refs.push(ref);return /Icon|Download/.test(ref)?DownloadIcon:downloadImage;}};
  const native=await loadNativeMermaidActions({rspack,Button:'button'});
  assert.equal(native.DownloadIcon,DownloadIcon);assert.equal(native.Button,'button');
  const blob=new Blob(['png']);assert.equal(await native.downloadImage({downloadSrc:blob,suggestedFilename:'diagram.png'}),true);assert.equal(calls[0].downloadSrc,blob);
  assert.deepEqual(refs,renamed?['renamed$.stream','other$.Icon']:['files.download','glyph.Download']);
  await assert.rejects(loadNativeMermaidActions({rspack:{...rspack,binding:()=>()=>{}}}),/unavailable/);
  await assert.rejects(loadNativeMermaidActions({rspack:{...rspack,module:()=>({source:source.replace('suggestedFilename:','changed:')})}}),/unavailable/);
});

test('Rspack download icon follows the native component and asset pair',async()=>{
  const source='id:"imagePreviewDialog.label";onClick:()=>{(0,files.save)({downloadSrc:blob,onDownloaded:done,suggestedFilename:name})};children:(0,R.jsx)(glyph.Image,{"aria-hidden":!1,asset:assets.Download})';
  const Icon=()=>{},asset={name:'download'},downloadImage=()=>{const protocol='workspaceFiles.saveStream',failure='Failed to download image';return protocol&&failure;};
  const bindings={'files.save':downloadImage,'glyph.Image':Icon,'assets.Download':asset};
  const rspack={module:predicate=>{assert.ok(predicate(source));return{source};},binding:(_entry,ref)=>bindings[ref]};
  const React={createElement:(type,props)=>({type,props})};
  const native=await loadNativeMermaidActions({rspack,React});
  const icon=native.DownloadIcon({className:'icon-xs'});
  assert.equal(icon.type,Icon);assert.equal(icon.props.asset,asset);assert.equal(icon.props.className,'icon-xs');
  assert.equal(native.downloadImage,downloadImage);
  await assert.rejects(loadNativeMermaidActions({rspack:{...rspack,binding:(_entry,ref)=>ref==='assets.Download'?null:bindings[ref]},React}),/unavailable/);
});
