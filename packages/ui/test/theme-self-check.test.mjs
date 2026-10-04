import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {createNativeThemeAdapter} from "../src/native/theme.mjs";

test("token diagnosis reads the actual scope, aliases and disappearing native values without writing", () => {
  const root={},scope={};
  let scoped={"--app-color-new-text":"white","--mcx-color-text-primary":"black"};
  const create=vm.runInNewContext(`(${createNativeThemeAdapter.toString()})`,{document:{documentElement:root},getComputedStyle:node=>({getPropertyValue:name=>(node === scope ? scoped : {"--color-text-primary":"black"})[name] ?? ""})});
  const theme=create(["--color-text-primary","--scope-only"],{"--color-text-primary":["--color-new-text"]},{"--color-text-primary":"--mcx-color-text-primary"});
  const read=()=>theme.checkTokens(scope,["--color-text-primary"])[0];
  assert.equal(read().source,"--app-color-new-text");
  assert.equal(read().value,"white");
  assert.equal(read().projectValue,"black");
  assert.equal(read().scopeMatches,false);
  scoped={"--mcx-color-text-primary":"black"};
  assert.equal(read().available,false);
  assert.equal(theme.diagnostics()[0].available,true);
  assert.equal(theme.diagnostics().length,1);
  assert.equal(theme.checkTokens(scope,["--scope-only"])[0].available,false);
});
