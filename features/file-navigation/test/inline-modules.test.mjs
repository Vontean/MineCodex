import test from 'node:test';
import assert from 'node:assert/strict';
import {loadInlineFileNavigationModules} from '../src/adapters/codex/inline-modules.mjs';

for(const renamed of [false,true])test(`inline file navigation binds only owned roles${renamed?' after renaming':''}`,async()=>{
  const base='file:///assets/',calls=[];let initialized=0;
  let source='import{react as reactFactory,bridge as Host,cancel as withSignal}from"./app-shared-fixture.js";R=reactFactory();/*(0,R.useState)*/function boot(){return(boot=once((()=>{Cache=cacheFactory()})))()}function Tree(e){(0,R.useState)();let t=(0,Cache.c)(1),{contextMenuEnabled:a,initialExpandedPaths:b,onSelectionChange:c}=e}async function directory(e,t){t?.throwIfAborted();let n=Host.workspaceFiles;if(n?.listDirectory==null)throw Error();return withSignal(n.listDirectory(e),t)}export{Tree as TREE,boot as BOOT};';
  if(renamed)source=source.replaceAll('Tree','Renamed$Tree').replaceAll('Cache','Renamed$Cache').replaceAll('Host','Renamed$Host');
  const React={createElement(){}},ReactDOM={createRoot(){}},folder={name:'folder-light-16',canvas:{viewBox:'0 0 16 16'},body:'<path/>'};
  const shared={react:()=>React,dom:()=>ReactDOM,bridge:{workspaceFiles:{listDirectory:params=>{calls.push(params);return Promise.resolve({entries:[]});}}},cancel:(promise,signal)=>{calls.push(signal);return promise;},ICON_INIT:()=>{initialized++;shared.folder=folder;}};
  const sources={
    [base+'app-initial-fixture.js']:source,
    [base+'app-main-fixture.js']:'import{dom as factory}from"./app-shared-fixture.js";D=factory();/*(0,D.createRoot)*/',
    [base+'app-shared-fixture.js']:'function iconBoot(){return(iconBoot=once((()=>{folder=icon({name:`folder-light-16`})})))()}export{iconBoot as ICON_INIT};',
  };
  const initial={TREE:function Tree(){},BOOT:()=>initialized++};
  const native=await loadInlineFileNavigationModules(base+'app-initial-fixture.js',base+'app-main-fixture.js',async url=>sources[url],async url=>url.includes('app-initial')?initial:shared);
  assert.equal(native.Tree,initial.TREE);assert.equal(native.React,React);assert.equal(initialized,2);
  const params={hostId:'local',workspaceRoot:'/repo',directoryPath:'docs',includeHidden:true},signal=new AbortController().signal;
  assert.deepEqual(await native.request('workspace-directory-entries',{params,signal}),{entries:[]});
  assert.deepEqual(calls,[params,signal]);
  const aborted=new AbortController();aborted.abort();
  assert.throws(()=>native.request('workspace-directory-entries',{params,signal:aborted.signal}),{name:'AbortError'});
  assert.equal(calls.length,2);
  sources[base+'app-initial-fixture.js']=source.replace('initialExpandedPaths','unrelated');
  await assert.rejects(loadInlineFileNavigationModules(base+'app-initial-fixture.js',base+'app-main-fixture.js',async url=>sources[url],async()=>initial),/inline-tree-unavailable/);
});
