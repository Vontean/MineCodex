import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { CONTROL_PANEL_BROWSER_SCRIPT, openMacControlPanel } from '../src/browser-control-panel.mjs';

function script({bundle='com.google.Chrome', urls=[], running=true, denied=false}={}) {
  let activated=0;
  const windows=urls.map(list=>({tabs:()=>list.map(url=>({url:()=>url}))}));
  const browser={running:()=>running,windows:()=>{if(denied)throw {errorNumber:-1743};return windows;},activate:()=>activated++};
  const run=vm.runInNewContext(`${CONTROL_PANEL_BROWSER_SCRIPT};run`,{ObjC:{import(){},unwrap:x=>x,castRefToObject:x=>x},$:Object.assign(x=>x,{LSCopyDefaultHandlerForURLScheme:()=>bundle}),Application:id=>{assert.equal(id,bundle);return browser;}});
  const result=JSON.parse(run(['http://127.0.0.1:47830/auth?exchange=test','http://127.0.0.1:47830']));
  return {result,windows,activated};
}
test('focuses an existing default Chromium tab across windows without navigating it',()=>{
  const {result,windows,activated}=script({urls:[['https://example.com'],['http://127.0.0.1:47830/','https://example.com']]});
  assert.equal(result.mode,'reused');assert.equal(windows[1].activeTabIndex,1);assert.equal(windows[1].index,1);assert.equal(windows[1].minimized,false);assert.equal(activated,1);
});
test('Safari selects its existing tab; unrelated origins and pages never match',()=>{
  const {result,windows}=script({bundle:'com.apple.Safari',urls:[['http://127.0.0.1:478300/','http://127.0.0.1:47830/other','http://127.0.0.1:47830/auth?exchange=old']]});
  assert.equal(result.mode,'reused');assert.equal(windows[0].currentTab.url(),'http://127.0.0.1:47830/auth?exchange=old');
  assert.equal(script({urls:[['https://127.0.0.1:47830/']]}).result.mode,'open');
});
test('only opens the default browser when no control panel tab exists',async()=>{
  const calls=[];const exec=async(file,args)=>{calls.push([file,args]);return {stdout:JSON.stringify({mode:'open',reuseSupported:true})};};
  const result=await openMacControlPanel(exec,'http://127.0.0.1:47830/auth?exchange=test','http://127.0.0.1:47830');
  assert.equal(result.mode,'opened');assert.equal(calls[1][0],'/usr/bin/open');assert.equal(calls.length,2);
  calls.length=0;await openMacControlPanel(async(file,args)=>{calls.push([file,args]);return {stdout:'{"mode":"reused","reuseSupported":true}'};},'http://127.0.0.1:47830/auth?exchange=test','http://127.0.0.1:47830');assert.equal(calls.length,1);
});
test('automation denial is reported instead of silently opening duplicate tabs',async()=>{
  assert.equal(script({denied:true}).result.code,-1743);
  let calls=0;await assert.rejects(openMacControlPanel(async()=>{calls++;return {stdout:'{"mode":"failed","code":-1743}'};},'http://127.0.0.1:47830/auth?exchange=test','http://127.0.0.1:47830'),/自动化/);assert.equal(calls,1);
  await assert.rejects(openMacControlPanel(async()=>{throw new Error('secret exchange');},'http://127.0.0.1:47830/auth?exchange=test','http://127.0.0.1:47830'),/无法连接/);
});
test('only loopback control panel authentication URLs are accepted',async()=>{
  for(const url of ['https://evil.test/auth?exchange=test','http://127.0.0.1:47830/not-auth','http://127.0.0.1:47830/auth'])await assert.rejects(openMacControlPanel(()=>assert.fail('must not execute'),url,'http://127.0.0.1:47830'),/Invalid/);
});
