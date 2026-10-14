import test from 'node:test';
import assert from 'node:assert/strict';
import {saveQvDiagram,exportQvDiagram} from '../src/mermaid/export.mjs';
import {createPageScriptSource} from '../src/injection-source.mjs';

test('native system save receives PNG bytes and an absolute Downloads default, including large payloads',async()=>{
 const bytes=Uint8Array.from({length:70000},(_,i)=>i%256);let request;
 const result=await saveQvDiagram(new Blob([bytes]),async(...args)=>{request=args;return{path:null};},'/Users/test/Downloads','mermaid-diagram.png');
 assert.deepEqual(result,{path:null},'cancel is not a download error');
 assert.equal(request[0],'save-file');assert.equal(request[1].params.suggestedFilename,'/Users/test/Downloads/mermaid-diagram.png');
 assert.deepEqual(new Uint8Array(Buffer.from(request[1].params.contentsBase64,'base64')),bytes);
});
test('export copy is released on failure without changing source geometry',async()=>{
 let removed=false,appended=false;const scene={offsetWidth:900,offsetHeight:400},viewport={offsetWidth:736};
 const copiedScene={style:{cssText:''}},copiedViewport={style:{cssText:''}};
 const copy={classList:{add(){}},style:{cssText:''},offsetHeight:420,querySelector:s=>s==='.scene'?copiedScene:copiedViewport,querySelectorAll:()=>[],append(){},remove(){removed=true;}};
 const root={clientWidth:736,id:'chart',cloneNode:()=>copy,querySelector:s=>s==='.scene'?scene:viewport};
 const doc={fonts:{ready:Promise.resolve()},querySelector:()=>root,createElement:()=>({}),body:{append(){appended=true;}}};
 const frame={contentDocument:doc,contentWindow:{getComputedStyle:()=>({backgroundColor:'white'})}};
 await assert.rejects(exportQvDiagram(frame,async(node,opts)=>{assert.equal(node,copy);assert.equal(opts.width,900);assert.equal(opts.height,420);assert.equal(opts.pixelRatio,2);throw Error('canvas');}),/canvas/);
 assert.ok(appended&&removed);assert.deepEqual(scene,{offsetWidth:900,offsetHeight:400});
});
test('serialized adapter includes export, native save and the host Downloads directory',async()=>{
 const source=await createPageScriptSource();
 assert.ok(source.includes('const exportQvDiagram ='));assert.ok(source.includes('const saveQvDiagram ='));assert.ok(source.includes('const markdownDownloadsDirectory='));
});
