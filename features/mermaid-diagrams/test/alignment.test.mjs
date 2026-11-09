import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildQvTemplate } from '../../../scripts/build-qv-mermaid.mjs';
import { parse } from 'acorn';

test('title wrapping shares the legend observer and follows replaced headings without touching fallback', async () => {
  const {script}=await buildQvTemplate();
  const ast=parse(script,{ecmaVersion:'latest'});let helper;
  function visit(node){if(node?.type==='FunctionDeclaration'&&node.id?.name==='alignMermaidLegends')helper=script.slice(node.start,node.end);for(const value of Object.values(node||{})){if(Array.isArray(value))value.forEach(visit);else if(value?.type)visit(value);}}
  visit(ast);assert.ok(helper);
  let resize,observers=0;
  const heading=()=>({offsetHeight:24,scrollHeight:24,wrapped:false,toggleAttribute(name,value){assert.equal(name,'data-title-wrapped');this.wrapped=value;}});
  let title=heading();
  const root={dataset:{state:'enhanced'},clientWidth:1000,querySelector:()=>title,querySelectorAll:()=>[]};
  const align=vm.runInNewContext(`(${helper})`,{document:{getElementById:()=>true},getComputedStyle:()=>({lineHeight:'24px'}),ResizeObserver:class{constructor(callback){resize=callback;observers++;}observe(){}},requestAnimationFrame:fn=>fn()});
  align(root);assert.equal(title.wrapped,false);
  root.clientWidth=320;title.offsetHeight=title.scrollHeight=72;resize();assert.equal(title.wrapped,true);
  root.clientWidth=1000;title.offsetHeight=title.scrollHeight=24;resize();assert.equal(title.wrapped,false);
  title=heading();title.offsetHeight=title.scrollHeight=48;align(root);assert.equal(title.wrapped,true);assert.equal(observers,1);
  title.offsetHeight=0;align(root);assert.equal(title.wrapped,false);
  root.dataset.state='native';title.scrollHeight=72;align(root);assert.equal(title.wrapped,false);
});
