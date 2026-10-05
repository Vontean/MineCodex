import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {installMcpAppChrome} from '../src/native/mcp-app.mjs';

test('MCX hides only its native header, restores reused surfaces and keeps React nodes',()=>{
  const makeHeader=(hidden=false)=>({hidden,attributes:new Set(),setAttribute(name){this.attributes.add(name);},hasAttribute(name){return this.attributes.has(name);},removeAttribute(name){this.attributes.delete(name);}});
  const own={header:makeHeader(),source:{server:'minecodex'}};
  const other={header:makeHeader(),source:{server:'other'}};
  for (const surface of [own,other]) surface.querySelector=()=>surface.header;
  let changed,disconnected=false;
  const install=vm.runInNewContext(`(${installMcpAppChrome.toString()})`,{
    MutationObserver:class {constructor(callback){changed=callback;}observe(){}disconnect(){disconnected=true;}},
    document:{documentElement:{},querySelectorAll:()=>[own,other]},
  });
  const lifetime=new AbortController();
  install(lifetime.signal,{props:(surface,predicate)=>predicate(surface)?surface:null},{server:'minecodex',pluginId:'minecodex@minecodex-local'});
  assert.equal(own.header.hidden,true);assert.equal(other.header.hidden,false);
  const original=own.header;
  own.source.server='other';changed();assert.equal(original.hidden,false);
  own.source.server='minecodex';changed();assert.equal(original.hidden,true);
  own.source={server:'plugin_minecodex_minecodex',pluginId:'minecodex@minecodex-local'};changed();assert.equal(original.hidden,true);
  lifetime.abort();assert.equal(disconnected,true);assert.equal(original.hidden,false);
  assert.equal(own.header,original);assert.equal(original.attributes.size,0);
});
