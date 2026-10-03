import assert from "node:assert/strict";
import test from "node:test";
import {createImageSourcesAdapter} from "../src/adapters/codex/image-sources.mjs";

test("Images applicability follows the observed native route and tab, not the feature name", () => {
  let location=null;
  const adapter=createImageSourcesAdapter({rail:()=>({}),props:()=>location ? {router:{state:{location}}} : null});
  assert.equal(adapter.applicability(),"unknown");
  location={pathname:"/space/files",search:"?tab=images"};
  assert.equal(adapter.applicability(),"applicable");
  location.search="?tab=files";
  assert.equal(adapter.applicability(),"not-applicable");
  location={pathname:"/space/images",search:""};
  assert.equal(adapter.applicability(),"not-applicable");
});
