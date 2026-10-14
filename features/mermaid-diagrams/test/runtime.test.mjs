import test from 'node:test';
import assert from 'node:assert/strict';
import { createMermaidRuntime } from '../src/adapters/codex/runtime.mjs';

function fixture(overrides={}) {
  const reports=[], installed=[], removed=[];
  const capabilities={
    loadMarkdownListAPI:async()=>({}),loadNativeMarkdownToc:async()=>({}),
    loadNativeMarkdownTableActions:async value=>value,loadNativeMermaidActions:async value=>value,
    installMarkdownMermaid(view,api,native,codex,resources,onStatus) {
      installed.push(view);onStatus(true);
      const cleanup=()=>removed.push(view);cleanup.available=()=>true;return cleanup;
    },...overrides,
  };
  const runtime=createMermaidRuntime({report:(...args)=>reports.push(args)},{},capabilities);
  const attach=()=>{const editor={},view={dom:editor,state:{tree:{}}};return {view,session:runtime.attach({editor,content:{cmTile:{view}}})};};
  return {attach,reports,installed,removed};
}
test('diagram sessions install independently and each cleanup restores only its own view',async()=>{
  const f=fixture(),a=f.attach(),b=f.attach();await Promise.all([a.session.ready,b.session.ready]);
  assert.equal(f.installed.length,2);assert.equal(a.session.checks()[0].available,true);
  a.session.dispose();a.session.dispose();assert.deepEqual(f.removed,[a.view]);
  b.session.dispose();assert.deepEqual(f.removed,[a.view,b.view]);
});
test('closing a preview or destroying the editor before async loading finishes prevents installation',async()=>{
  for(const destroy of [false,true]) {
    let resolve;const pending=new Promise(done=>resolve=done);
    const f=fixture({loadMarkdownListAPI:()=>pending}),{view,session}=f.attach();
    if(destroy)view.destroyed=true;else session.dispose();resolve({});await session.ready;
    assert.equal(f.installed.length,0);assert.equal(f.reports.length,0);session.dispose();
  }
});
test('failed native loading can retry on the next preview and reports only diagram failure',async()=>{
  let attempts=0;const f=fixture({loadNativeMermaidActions:async()=>{if(++attempts===1)throw Error('missing');return {};}});
  const first=f.attach();await first.session.ready;assert.equal(first.session.checks()[0].available,false);
  first.session.dispose();const second=f.attach();await second.session.ready;
  assert.equal(second.session.checks()[0].available,true);second.session.dispose();
  assert.ok(f.reports.every(([name])=>name==='mermaid-diagrams-renderer'));
});
