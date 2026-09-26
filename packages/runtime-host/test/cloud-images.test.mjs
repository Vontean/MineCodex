import test from "node:test";
import assert from "node:assert/strict";
import { cloudImagesInRenderer, cloudImagesAction } from "../src/cloud-images.mjs";

const key = Symbol.for("minecodex.cloud-images.v1");
function fixture(context, {role = "assistant", prompt = "", size = 3} = {}) {
  const file = {id:"libfile_test",file_id:"file_test",mime_type:"image/png",file_size_bytes:size,origination_thread_id:"chat-test",origination_message_id:"image",current_version_number:1,updated_at:"date",file_name:"Generated.png"};
  let downloads=0, conversations=0;
  const api = {
    safePost: async () => ({items:[file,{...file,id:"trashed",trashed_at:"date"},{...file,id:"document",mime_type:"text/plain"}],cursor:null}),
    safeGet: async () => {
      conversations++;
      return {title:"Chat title",create_time:1,mapping:{image:{id:"image",parent:"user",message:{author:{role},create_time:2,content:{parts:[{content_type:"image_asset_pointer",asset_pointer:"sediment://file_test",metadata:{generation:{gen_id:"gen"},dalle:{prompt}}}]}}},user:{id:"user",parent:null,message:{author:{role:"user"},content:{parts:["Draw a cat"]}}}}};
    },
  };
  globalThis.window = {[key]:{files:new Map(),conversations:new Map(),capability:Promise.resolve({api,response:async()=>{downloads++;return new Blob([new Uint8Array([1,2,3])],{type:"image/png"});}})}};
  context.after(()=>delete globalThis.window);
  return {stats:()=>({downloads,conversations})};
}
test("cloud sync excludes non-images and uploads, preserves exact source identity and prompt provenance", async context => {
  const f=fixture(context);
  const page=await cloudImagesInRenderer("list",{});
  assert.equal(page.items.length,1);
  const result=await cloudImagesInRenderer("import",{libraryId:"libfile_test"});
  assert.equal(result.prompt,"Draw a cat");
  assert.equal(result.promptKind,"request");
  assert.equal(result.cloudLibraryId,"libfile_test");
  assert.equal(result.itemId,"file_test");
  assert.equal(result.bytesBase64,"AQID");
  await cloudImagesInRenderer("import",{libraryId:"libfile_test"});
  assert.equal(f.stats().conversations,1);
});
test("real generator prompt takes precedence over user request", async context => {
  fixture(context,{prompt:"Exact generation prompt"});await cloudImagesInRenderer("list",{});
  const r=await cloudImagesInRenderer("import",{libraryId:"libfile_test"});
  assert.equal(r.promptKind,"generation");assert.equal(r.prompt,"Exact generation prompt");
});
test("uploaded reference images are not downloaded or imported", async context => {
  const f=fixture(context,{role:"user"});await cloudImagesInRenderer("list",{});
  assert.deepEqual(await cloudImagesInRenderer("import",{libraryId:"libfile_test"}),{skipped:true});
  assert.equal(f.stats().downloads,0);
});
test("unlisted files, oversized images and invalid host input are rejected", async context => {
  const f=fixture(context,{size:33*1024*1024});await cloudImagesInRenderer("list",{});
  await assert.rejects(cloudImagesInRenderer("import",{libraryId:"libfile_other"}),/current Library/);
  await assert.rejects(cloudImagesInRenderer("import",{libraryId:"libfile_test"}),/32 MB/);
  assert.equal(f.stats().downloads,0);
  await assert.rejects(cloudImagesAction({},"import",{libraryId:"https://example.com"}),/Invalid/);
});
