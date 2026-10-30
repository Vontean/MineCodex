import test from 'node:test';
import assert from 'node:assert/strict';
import {createLibraryApi} from '../src/adapters/codex/library-api.mjs';

test('one native Library discovery supports named viewer and import operations',async context=>{
  const initial='file:///assets/app-initial-a.js',metadata='file:///assets/library-file-metadata-a.js';
  globalThis.document={querySelectorAll:()=>[{src:initial}]};context.after(()=>delete globalThis.document);
  let initialReads=0,initializations=0;const requests=[];
  const client={safeGet:async(path,options)=>{requests.push({path,options});return {title:'conversation'};},safePost:async(path,options)=>{requests.push({path,options});return {items:[],cursor:null};}};
  const adapter=createLibraryApi({
    read:async url=>{if(url===initial){initialReads++;return 'library-file-metadata-a.js library-file-download-a.js';}
      if(url===metadata)return 'import{client as a}from"./app-initial-a.js";function z(){return(z=()=>{})()}function metadata(){a.safePost(`/files/library`)}export{z as initialize}';throw new Error('unknown asset');},
    load:async url=>url===metadata ? {initialize:()=>initializations++}:{client},
  });
  const signal=new AbortController().signal;
  assert.equal((await adapter.conversation('thread',signal)).title,'conversation');
  await adapter.list('next',signal);await adapter.conversation('thread2',signal);
  assert.equal(initialReads,1);assert.equal(initializations,1);
  assert.equal(requests[0].options.parameters.path.conversation_id,'thread');
  assert.equal(requests[1].options.requestBody.cursor,'next');assert.equal(requests[0].options.signal,signal);
  assert.equal('safeGet' in adapter,false);assert.equal('safePost' in adapter,false);
});
test('changed Library export fails explicitly and discovery retries instead of caching failure',async context=>{
  globalThis.document={querySelectorAll:()=>[{src:'file:///assets/app-initial-a.js'}]};context.after(()=>delete globalThis.document);
  let reads=0;const adapter=createLibraryApi({read:async()=>{reads++;return 'unknown';},load:async()=>({})});
  await assert.rejects(adapter.conversation('thread'),/capability/);const afterFirst=reads;await assert.rejects(adapter.list(null),/capability/);assert.ok(reads>afterFirst);
});
