import test from "node:test";
import assert from "node:assert/strict";
import {createCloudImageActions} from "../src/frontend/cloud-image-actions.mjs";

function fixture() {
  let referenceId=null, uploads=0, saved=false, failFavorite=false;
  const operations=[];
  const actions=createCloudImageActions({
    assertAccount:()=>{},
    reference:async(image,operation,payload)=>{
      operations.push(operation);
      if(operation==="reference")return {libraryFileId:referenceId};
      if(operation==="upload-file")return {fingerprint:"exact bytes"};
      if(operation==="begin-upload")return {started:true};
      assert.equal(payload.fingerprint,"exact bytes");referenceId=payload.libraryFileId;
    },
    upload:async()=>{uploads++;await Promise.resolve();return "libfile_image";},
    favoriteStatus:async()=>saved?"favorite_id":null,
    setFavorite:async(id,favoriteId,desired)=>{assert.equal(id,"libfile_image");if(failFavorite)return false;saved=desired;return true;},
  });
  return {actions,operations,get uploads(){return uploads;},set failFavorite(value){failFavorite=value;}};
}
const image={id:"local-image"};

test("concurrent operations register once; later actions reuse identity without exposing native nodes",async()=>{
  const f=fixture();
  const [first,second]=await Promise.all([f.actions.registered(image),f.actions.registered(image)]);
  assert.equal(f.uploads,1);assert.equal(first.created,true);assert.equal(first,second);
  // 文件夹选择取消不提交移动，后续操作仍复用同一身份。
  assert.equal(await f.actions.favorite(image),true);
  const next=await f.actions.registered(image);
  assert.deepEqual(next,{libraryFileId:"libfile_image",created:false});
  assert.equal(f.uploads,1);assert.equal(await f.actions.favorite(image),false);
});

test("favorite failure retains successful upload; retry consults server without uploading again",async()=>{
  const f=fixture();f.failFavorite=true;
  await assert.rejects(f.actions.favorite(image));
  assert.ok(f.operations.indexOf("register")>f.operations.indexOf("upload-file"));
  f.failFavorite=false;assert.equal(await f.actions.favorite(image),true);assert.equal(f.uploads,1);
});

test("account change prevents an upload after preparing file bytes",async()=>{
  let checks=0,uploads=0;
  const actions=createCloudImageActions({assertAccount:()=>{if(++checks===3)throw Error("account changed");},reference:async(_,op)=>op==="reference"?{}:{fingerprint:"bytes"},upload:async()=>{uploads++;}});
  await assert.rejects(actions.registered(image),/account changed/);assert.equal(uploads,0);
});


test("uncertain upload never starts another upload, including after workflow recreation",async()=>{
  let state="ready",uploads=0;
  const ports={
    assertAccount:()=>{},reference:async(_,operation)=>{
      if(operation==="reference")return {status:state};
      if(operation==="upload-file")return {fingerprint:"bytes"};
      if(operation==="begin-upload"){state="uploading";return {started:true};}
    },upload:async()=>{uploads++;throw Error("process response lost");},
  };
  await assert.rejects(createCloudImageActions(ports).registered(image),{code:"UPLOAD_UNCONFIRMED"});
  await assert.rejects(createCloudImageActions(ports).registered(image),{code:"UPLOAD_UNCONFIRMED"});
  assert.equal(uploads,1);
});

test("late cached identity cannot trigger a favorite after its owner changes",async()=>{
  let finish,current=true,statusReads=0;
  const actions=createCloudImageActions({
    assertAccount:()=>{if(!current)throw Error("owner changed");},
    reference:()=>new Promise(resolve=>{finish=resolve;}),
    favoriteStatus:async()=>{statusReads++;},
  });
  const task=actions.favorite(image);
  current=false;finish({libraryFileId:"libfile_image"});
  await assert.rejects(task,/owner changed/);assert.equal(statusReads,0);
});

test("successful upload persists its identity even when the initiating view is disposed",async()=>{
  let finish,current=true,registered=null,statusReads=0;
  const actions=createCloudImageActions({
    assertAccount:()=>{if(!current)throw Error("owner changed");},
    reference:async(_,operation,payload)=>{
      if(operation==="reference")return {};
      if(operation==="upload-file")return {fingerprint:"exact bytes"};
      if(operation==="begin-upload")return {started:true};
      if(operation==="register")registered=payload;
    },
    upload:()=>new Promise(resolve=>{finish=resolve;}),
    favoriteStatus:async()=>{statusReads++;},
  });
  const task=actions.favorite(image);
  while(!finish)await Promise.resolve();
  current=false;finish("libfile_image");
  await assert.rejects(task,/owner changed/);
  assert.deepEqual(registered,{libraryFileId:"libfile_image",fingerprint:"exact bytes"});
  assert.equal(statusReads,0);
});
