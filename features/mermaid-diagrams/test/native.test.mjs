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
  const loader=vm.runInContext(`(${loadNativeMermaidActions})`,context);
  const native=await loader({Button:'button'},{read:async()=>source,load});
  assert.equal(native.DownloadIcon,Icon);assert.equal(native.Button,'button');
  const blob=new Blob(['png']);assert.equal(await native.downloadImage({downloadSrc:blob,suggestedFilename:'mermaid-diagram.png'}),true);
  assert.equal(calls[0].downloadSrc,blob);
  await assert.rejects(loader({},{read:async()=>source.replace('downloadLocal as D','missing as D').replace('renamed$Download as D','missing as D'),load}),/unavailable/);
});
