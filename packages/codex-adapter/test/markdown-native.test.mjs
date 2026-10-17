import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {loadNativeMarkdownRenderer} from '../src/markdown/markdown-native.mjs';

for (const local of [false,true]) test(`Markdown resolves ${local?'local exported':'imported'} lexer independently of shared components`,async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'mcx-markdown-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await writeFile(path.join(dir,'app-shared-fixture.mjs'),'export const tokenise=text=>[text];');
  const url=pathToFileURL(path.join(dir,'app-initial.mjs')).href;
  const source=`import{tokenise as ${local?'other':'lex'}}from"./app-shared-fixture.mjs";function md(e){getDefaultComponents:r,...n}function boot(){}function init(){return(init=x((()=>{boot()})))()}tokens:lex(e,void 0);export{md as M,init as I${local?',lex as L':''}}`;
  let initialized=0;
  const module={M(){},I(){initialized++;},L:text=>[text]};
  const native=await loadNativeMarkdownRenderer(source,url,module);
  assert.equal(native.Markdown,module.M);
  assert.equal(initialized,1);
  assert.deepEqual(native.lexer('hello'),['hello']);
  assert.equal(native.sharedUrl,new URL('./app-shared-fixture.mjs',url).href);
  if(local) {
    await assert.rejects(loadNativeMarkdownRenderer(source,url,{...module,L:undefined}),/native-markdown-lexer-unavailable/);
    await assert.rejects(loadNativeMarkdownRenderer(source.replace('./app-shared-fixture.mjs','./other.mjs'),url,module),/native-markdown-lexer-unavailable/);
  }
});
