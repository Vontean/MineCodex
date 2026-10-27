import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {replaceModelSliderShell} from '../src/frontend/install.mjs';
import {createModelSliderInstallerSource} from '../src/injection-source.mjs';

test('shell replacement restores only the focused slider in a connected menu',()=>{
  const document={activeElement:null},focused=[];
  const replace=vm.runInContext(`(${replaceModelSliderShell})`,vm.createContext({document}));
  const rail={focus:options=>{focused.push(options);document.activeElement=rail;}};
  const shell={isConnected:true,querySelector:()=>rail};
  const menu={isConnected:true,append(){}};
  const oldRail={},existing={querySelector:()=>oldRail,remove(){document.activeElement=null;}};
  document.activeElement=oldRail;replace(menu,existing,shell);
  assert.equal(document.activeElement,rail);assert.equal(focused.length,1);assert.equal(focused[0].preventScroll,true);
  document.activeElement={};replace(menu,existing,shell);assert.equal(focused.length,1);
  document.activeElement=oldRail;menu.isConnected=false;replace(menu,existing,shell);assert.equal(focused.length,1);
});
test('focus helper is included in the serialized renderer closure',()=>{
  assert.doesNotThrow(()=>new Function(`return (${createModelSliderInstallerSource()})`)());
});
