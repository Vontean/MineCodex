import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {LocalImageSource} from "../src/backend/local-image-source.mjs";

test("local gallery preserves exact image identity and provides native file identity without arbitrary file reads",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"mcx-gallery-"));
  const sourcePath=path.join(root,"result.png");await writeFile(sourcePath,Buffer.from([1,2,3]));
  const image={id:"a".repeat(24),threadId:"thread",imageGenerationItemId:"result",sourcePath,byteLength:3,width:100,height:200,prompt:"exact revised prompt",promptKind:"generation"};
  let starts=0,closed=false;
  const library={start:async()=>{starts++;},list:()=>[image],count:()=>1,hydratePrompt:async id=>id===image.id?image:null,get:id=>id===image.id?image:null,close:()=>{closed=true;}};
  const service=new LocalImageSource({library});
  try{
    await assert.rejects(service.action({operation:"prompt",id:"../../secret"}));assert.equal(starts,0);
    const [list,detail]=await Promise.all([service.action({operation:"list"}),service.action({operation:"prompt",id:image.id})]);
    assert.equal(starts,1);assert.equal(list.total,1);assert.equal(detail.text,image.prompt);assert.equal(list.images[0].imageGenerationItemId,"result");assert.equal(list.images[0].sourcePath,sourcePath);assert.equal(list.images[0].prompt,undefined);
    assert.equal(await service.action({operation:"prompt",id:"b".repeat(24)}),null);
    await service.close();assert.equal(closed,true);await assert.rejects(service.action({operation:"list"}));
  }finally{await service.close();await rm(root,{recursive:true,force:true});}
});

test("cloud references persist per account and exact content; renderer cannot register an arbitrary file",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"mcx-cloud-reference-"));
  const image={id:"a".repeat(24),sourcePath:path.join(root,"image.png")};
  await writeFile(image.sourcePath,"original bytes");
  const library={start:async()=>{},get:id=>id===image.id?image:null,close:()=>{}};
  const args={id:image.id,accountId:"account",userId:"user",operation:"reference"};
  let service=new LocalImageSource({library,dataDir:root});
  try {
    const ref=await service.action(args);
    assert.equal(ref.libraryFileId,null);
    const upload=await service.action({...args,operation:"upload-file"});
    assert.equal(Buffer.from(upload.base64,"base64").toString(),"original bytes");
    await assert.rejects(service.action({...args,operation:"register",fingerprint:"stale",libraryFileId:"libfile_image"}));
    await assert.rejects(service.action({...args,operation:"register",fingerprint:ref.fingerprint,libraryFileId:"file_wrong"}));
    const reservations=await Promise.all([service.action({...args,operation:"begin-upload",fingerprint:ref.fingerprint}),service.action({...args,operation:"begin-upload",fingerprint:ref.fingerprint})]);
    assert.equal(reservations.filter(value=>value.started).length,1);
    assert.equal((await service.action(args)).status,"uploading");
    await service.action({...args,operation:"register",fingerprint:ref.fingerprint,libraryFileId:"libfile_image"});
    await service.close();service=new LocalImageSource({library,dataDir:root});
    assert.equal((await service.action(args)).libraryFileId,"libfile_image");
    assert.equal((await service.action({...args,accountId:"other"})).libraryFileId,null);
    await assert.rejects(service.action({...args,userId:"../secret"}));
    await assert.rejects(service.action({...args,id:"b".repeat(24),sourcePath:image.sourcePath}));
    await writeFile(image.sourcePath,"changed bytes");
    assert.equal((await service.action(args)).libraryFileId,null);
    await assert.rejects(service.action({...args,operation:"register",fingerprint:ref.fingerprint,libraryFileId:"libfile_image"}));
  }finally {await service.close();await rm(root,{recursive:true,force:true});}
});

test("hiding is immediate and persistent, keeps source files, and paginates visible records without gaps",async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),"mcx-hidden-images-"));
  const images=Array.from({length:40},(_,index)=>({id:index.toString(16).padStart(24,"0"),sourcePath:path.join(root,`${index}.png`)}));
  await Promise.all(images.map(image=>writeFile(image.sourcePath,"original")));
  const library={start:async()=>{},list:({limit,offset=0})=>limit?images.slice(offset,offset+limit):images,count:()=>images.length,get:id=>images.find(image=>image.id===id),close:()=>{}};
  let service=new LocalImageSource({library,dataDir:root});
  try {
    await assert.rejects(service.action({operation:"hide",ids:["../secret"]}));
    await assert.rejects(service.action({operation:"hide",ids:["f".repeat(24)]}));
    await Promise.all([service.action({operation:"hide",ids:[images[0].id]}),service.action({operation:"hide",ids:[images[1].id,images[1].id]})]);
    const first=await service.action({operation:"list"});
    assert.equal(first.total,38);assert.equal(first.images.length,36);assert.equal(first.images[0].id,images[2].id);
    const next=await service.action({operation:"list",offset:36});
    assert.deepEqual(next.images.map(image=>image.id),images.slice(38).map(image=>image.id));
    const {readFile}=await import("node:fs/promises");
    assert.equal(await readFile(images[0].sourcePath,"utf8"),"original");
    await service.close();service=new LocalImageSource({library,dataDir:root});
    assert.equal((await service.action({operation:"list"})).total,38);
  }finally {await service.close();await rm(root,{recursive:true,force:true});}
});
