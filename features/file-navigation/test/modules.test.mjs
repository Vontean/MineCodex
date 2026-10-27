import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loadFileNavigationModules} from '../src/adapters/codex/modules.mjs';

for(const stream of [false,true])test(`directory capability resolves ${stream?'workspaceFiles helper':'legacy request'} without changing scope or signal`,async()=>{
  const base='file:///assets/';
  const sources={
    'review-file-source-breadcrumb-current.js':'import{Tree as T}from"./base-file-tree-current.js";import{Query as Q}from"./workspace-directory-entries-query-current.js";',
    'base-file-tree-current.js':'import{react as init}from"./app-shared-current.js";owner=init();(0,owner.useState)(null)',
    'app-main-current.js':'import{dom as init}from"./app-shared-current.js";owner=init();(0,owner.createRoot)(node)',
    'workspace-directory-entries-query-current.js':stream?'import{directory as readDir}from"./workspace-directory-current.js";queryFn:({signal:s})=>readDir(params,s)':'import{request as send}from"./app-shared-current.js";queryFn:({signal:s})=>send(`workspace-directory-entries`,{params,signal:s})',
  };
  const calls=[],React={createElement(){}},ReactDOM={createRoot(){}},folder={name:'folder-light-16',canvas:{viewBox:'0 0 16 16'},body:'<path/>'};
  function Tree(){return {contextMenuEnabled:false};}
  const shared={react:()=>React,dom:()=>ReactDOM,folder,request:(...args)=>{calls.push(args);return {entries:[]};}};
  const loader=vm.runInContext(`(${loadFileNavigationModules})`,vm.createContext({URL,document:{querySelectorAll:()=>[{href:base+'review-file-source-breadcrumb-current.js'},{src:base+'app-main-current.js'}]}}));
  const native=await loader({read:async url=>sources[url.slice(base.length)],load:async url=>url.includes('base-file-tree')?{Tree}:url.includes('workspace-directory-current')?{directory:(...args)=>{calls.push(args);return {entries:[]};}}:shared});
  assert.equal(native.Tree,Tree);assert.equal(native.React,React);
  const params={hostId:'local',workspaceRoot:'/repo',directoryPath:'docs',includeHidden:true},signal=new AbortController().signal;
  assert.deepEqual(await native.request('workspace-directory-entries',{params,signal}),{entries:[]});
  assert.deepEqual(calls[0],stream?[params,signal]:['workspace-directory-entries',{params,signal}]);
});
