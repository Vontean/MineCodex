import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownExportAlias } from '../../../packages/codex-adapter/src/markdown/block-actions.mjs';
import { createPageScriptSource } from '../src/injection-source.mjs';

test('native export names match exactly, including dollar signs and prefix collisions', () => {
  const source = 'export{other$Yc as wrong,$Yc as Table,Yc as Plain,wrap$ as Wrap,Direct}';
  assert.equal(markdownExportAlias(source, '$Yc'), 'Table');
  assert.equal(markdownExportAlias(source, 'Yc'), 'Plain');
  assert.equal(markdownExportAlias(source, 'wrap$'), 'Wrap');
  assert.equal(markdownExportAlias(source, 'Direct'), 'Direct');
  assert.equal(markdownExportAlias(source, 'missing'), undefined);
  assert.equal(markdownExportAlias('no export', 'missing'), undefined);
});

test('serialized reading installer includes the export resolver', async () => {
  const source = await createPageScriptSource();
  assert.doesNotThrow(() => new Function('config', 'signal', source));
  const declarations = source.slice(0, source.indexOf('const marker ='));
  const resolve = new Function(`${declarations}; return markdownExportAlias;`)();
  assert.equal(resolve('export{$Yc as Table}', '$Yc'), 'Table');
});

import { markdownTableActionGeometry } from '../src/adapters/codex/tables.mjs';
test('table controls retain their readable anchor after nowrap breakout and horizontal scrolling',()=>{
  const frame={left:100,top:100,bottom:700,width:600},padding={left:56,right:56};
  const a=markdownTableActionGeometry({left:156,top:200,width:488},{bottom:500},frame,1,20,padding,16);
  const b=markdownTableActionGeometry({left:100,top:200,width:1200},{bottom:500},frame,1,20,padding,16);
  assert.deepEqual(a,b);assert.equal(a.left+a.width,544);assert.equal(a.inView,true);
});
test('toolbar remains inside the visible part of a tall table and handles zoom',()=>{
  for(const scale of [1,1.25,2]) {
    const geometry=markdownTableActionGeometry({top:-800},{bottom:800},{top:100,bottom:600,width:700},scale,400,{left:56,right:56},16);
    assert.equal(geometry.top,400);assert.equal(geometry.inView,true);
    assert.ok(geometry.width<=700/scale);
  }
  assert.equal(markdownTableActionGeometry({top:-800},{bottom:90},{top:100,bottom:600,width:700},1,400,{left:56,right:56},16).inView,false);
});

import vm from 'node:vm';
import {installMarkdownTableActions} from '../src/adapters/codex/table-actions.mjs';
test('restoring wrap stays available even when the expanded table no longer overflows',()=>{
  let tree,toggles=0;
  const h=(type,props,...children)=>({type,props:{...props,children}});
  const native={React:{createElement:h,Fragment:'fragment',useState:()=>[false,()=>{}],useRef:()=>({current:null}),useMemo:fn=>fn()},ReactDOM:{createRoot:()=>({render:value=>{tree=value;},unmount(){}})},Actions:'actions',Button:'button',Tooltip:'tooltip',CopyButton:'copy',wrapIcons:{enable:'enable',disable:'disable'}};
  const install=vm.runInContext(`(${installMarkdownTableActions})`,vm.createContext({document:{documentElement:{lang:'en'},createElement:()=>({dataset:{}})},captureMarkdownProviders:()=> (_react,content)=>content}));
  const controller={schedule(){},toggle(){toggles++;}};
  install({scrollDOM:{append(){}},dom:{}},native,{},controller);
  const walk=node=>node&&typeof node==='object'?[node,...(node.props?.children??[]).flatMap(walk)]:[];
  for(const fit of [true,false])for(const overflow of [true,false]){
    controller.renderActions([{id:'table',fit,overflow}]);
    const element=tree.props.children[0],rendered=element.type(element.props);
    const button=walk(rendered).find(node=>node.type==='button'&&/document word wrap/.test(node.props['aria-label']));
    assert.ok(button,`wrap control missing: fit=${fit} overflow=${overflow}`);
    assert.equal(button.props['aria-pressed'],fit);button.props.onClick();
  }
  assert.equal(toggles,4);
});
