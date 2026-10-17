import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createPageScriptSource} from '../src/injection-source.mjs';

for(const ending of ['live','dispose','abort']) test(`Sites refresh rejection after ${ending} respects its UI lifetime`,async()=>{
  const nodes=new Set(),controller=new AbortController();let reject;
  const document={documentElement:{lang:'en'},body:{append:n=>nodes.add(n)},head:{append:n=>nodes.add(n)},
    createElement:()=>({setAttribute(k,v){this[k]=v;},remove(){nodes.delete(this);}}),
    querySelector:()=>null,querySelectorAll:()=>[...nodes],addEventListener(){},removeEventListener(){}};
  const config={codex:{account:()=>({read:()=>({status:'unknown'})})},resources:{icons:{},styles:''},ui:{},requestHostAction:()=>new Promise((_,r)=>reject=r)};
  const install=vm.runInNewContext(`(signal,config)=>{${await createPageScriptSource()}}`,{document,MutationObserver:class{observe(){}disconnect(){}},setTimeout:()=>1,clearTimeout(){}});
  const dispose=install(controller.signal,config);
  if(ending==='dispose')dispose();
  if(ending==='abort')controller.abort();
  reject(new Error('delayed-failure'));await new Promise(r=>setImmediate(r));
  assert.equal([...nodes].filter(n=>n['data-mcx-sites']==='notice').length,ending==='live'?1:0);
  dispose();assert.equal(nodes.size,0);
});

test('Sites refresh completion after disposal cannot schedule new UI work',async()=>{
  let resolve,scheduled=0;
  const document={body:{},head:{append(){}},createElement:()=>({setAttribute(){}}),querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};
  const config={codex:{account:()=>({read:()=>({status:'unknown'})})},resources:{icons:{},styles:''},requestHostAction:()=>new Promise(r=>resolve=r)};
  const install=vm.runInNewContext(`(signal,config)=>{${await createPageScriptSource()}}`,{document,MutationObserver:class{observe(){}disconnect(){}},setTimeout:()=>++scheduled,clearTimeout(){}});
  const dispose=install(new AbortController().signal,config);dispose();const before=scheduled;
  resolve({sites:[],projects:[],threads:[]});await new Promise(r=>setImmediate(r));assert.equal(scheduled,before);
});
