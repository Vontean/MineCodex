import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {createPluginServer} from '../src/server.mjs';
import {readPreviewResource} from '../src/ui-resource.mjs';

test('MCP preview resources read only the requested feature media and reject paths outside the asset directory', async () => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'mcx-preview-media-'));
  try {
    await mkdir(path.join(dir,'assets/previews'),{recursive:true});
    await writeFile(path.join(dir,'assets/previews/manifest.json'),JSON.stringify({notes:{video:'notes.mp4'},sites:{poster:'sites.webp'},bad:{video:'../private.mp4'}}));
    await writeFile(path.join(dir,'assets/previews/notes.mp4'),'test-video');
    const uri=new URL('resource://minecodex/previews/notes/video');
    const r=await readPreviewResource(dir,'notes','video',uri);
    assert.equal(r.contents[0].mimeType,'video/mp4');
    assert.equal(Buffer.from(r.contents[0].blob,'base64').toString(),'test-video');
    await assert.rejects(()=>readPreviewResource(dir,'sites','poster',uri),{code:'ENOENT'});
    await assert.rejects(()=>readPreviewResource(dir,'bad','video',uri),/Invalid/);
    await assert.rejects(()=>readPreviewResource(dir,'notes','other',uri),/unavailable/);
    await assert.rejects(()=>readPreviewResource(dir,'__proto__','video',uri),/unavailable/);
  } finally {await rm(dir,{recursive:true,force:true});}
});


test('MCP resources/read serves on-demand feature video through the registered resource template', async () => {
  const root=await mkdtemp(path.join(os.tmpdir(),'mcx-preview-rpc-'));
  let client,server;
  try {
    for (const dir of ['assets/brand','features/notes/assets/icons','apps/dashboard/assets/previews']) await mkdir(path.join(root,dir),{recursive:true});
    await writeFile(path.join(root,'assets/brand/minecodex-icon.svg'),await readFile(new URL('../../../assets/brand/minecodex-icon.svg',import.meta.url)));
    await writeFile(path.join(root,'features/notes/assets/icons/prompt-entry.svg'),await readFile(new URL('../../../features/notes/assets/icons/prompt-entry.svg',import.meta.url)));
    await writeFile(path.join(root,'apps/dashboard/assets/previews/manifest.json'),JSON.stringify({notes:{video:'notes.webm'}}));
    await writeFile(path.join(root,'apps/dashboard/assets/previews/notes.webm'),'test-only-video');
    server=createPluginServer({paths:{packageRoot:root},client:{request:async()=>({})},promptsClient:{request:async()=>({})}});
    client=new Client({name:'preview-test',version:'1'});
    const [front,back]=InMemoryTransport.createLinkedPair();await server.connect(back);await client.connect(front);
    const result=await client.readResource({uri:'resource://minecodex/previews/notes/video'});
    assert.equal(result.contents[0].mimeType,'video/webm');
    assert.equal(Buffer.from(result.contents[0].blob,'base64').toString(),'test-only-video');
    await assert.rejects(()=>client.readResource({uri:'resource://minecodex/previews/sites/video'}));
  }finally {await client?.close();await server?.close();await rm(root,{recursive:true,force:true});}
});
