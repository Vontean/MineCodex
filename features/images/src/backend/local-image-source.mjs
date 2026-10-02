import os from "node:os";
import {createHash,randomUUID} from "node:crypto";
import {readFile,writeFile,mkdir,rename} from "node:fs/promises";
import path from "node:path";
import { ImageLibrary } from "../image-library.mjs";
import { ThreadMetadataIndex } from "../thread-metadata.mjs";

export class LocalImageSource {
  constructor({
    dataDir,
    sourceRoot = process.env.CODEX_IMAGEGEN_ROOT ?? path.join(os.homedir(), ".codex/generated_images"),
    sessionRoots,
    library,
  } = {}) {
    const root = path.join(os.homedir(), ".codex");
    this.library = library ?? new ImageLibrary({
      sourceRoot,
      dataDir,
      sessionRoots: sessionRoots ?? [
        process.env.CODEX_SESSION_ROOT ?? path.join(root, "sessions"),
        path.join(root, "archived_sessions"),
      ],
      threadMetadata: new ThreadMetadataIndex({
        stateDatabasePath: process.env.CODEX_STATE_DATABASE ?? path.join(root, "state_5.sqlite"),
        globalStatePath: process.env.CODEX_GLOBAL_STATE ?? path.join(root, ".codex-global-state.json"),
        sessionIndexPath: process.env.CODEX_SESSION_INDEX ?? path.join(root, "session_index.jsonl"),
      }),
    });
    this.dataDir = dataDir;
    this.hiddenIds = new Set();
    this.hiddenWrites = Promise.resolve();
    this.closed = false;
  }

  async start() {
    if (this.closed) throw new Error("Local image source is closed");
    if (!this.starting) {
      this.starting = (async () => {
        await this.library.start();
        if (this.dataDir) {
          try {this.hiddenIds = new Set(JSON.parse(await readFile(path.join(this.dataDir,"hidden-image-ids.json"),"utf8")));}
          catch(error) {if(error.code!=="ENOENT") throw error;}
        }
        if (this.closed) throw new Error("Local image source is closed");
      })();
    }
    await this.starting;
  }

  image(image) {
    return {
      id: image.id,
      threadId: image.threadId,
      imageGenerationItemId: image.imageGenerationItemId,
      sourcePath: image.sourcePath,
      name: path.basename(image.sourcePath),
      width: image.width,
      height: image.height,
      threadTitle: image.threadTitle,
    };
  }

  async action(payload = {}) {
    const {operation, offset = 0, id, query = ""} = payload;
    if (!["list", "prompt", "reference", "register", "upload-file", "begin-upload", "hide"].includes(operation)) throw new Error("Unknown local image source action");
    if (typeof query !== "string" || query.length > 256) throw new Error("Invalid image query");
    if (operation === "list" && (!Number.isInteger(offset) || offset < 0 || offset > 100000)) {
      throw new Error("Invalid image offset");
    }
    if (operation !== "list" && operation !== "hide" && !/^[a-f0-9]{24}$/.test(id ?? "")) throw new Error("Invalid image ID");
    if (operation === "hide" && (!Array.isArray(payload.ids) || !payload.ids.length || payload.ids.length>1000 || payload.ids.some(value=>typeof value!=="string" || !/^[a-f0-9]{24}$/.test(value)))) throw new Error("Invalid image selection");
    await this.start();
    if (this.closed) throw new Error("Local image source is closed");
    if (operation === "hide") {
      const ids=[...new Set(payload.ids)];
      if (!this.dataDir || ids.some(value=>!this.library.get(value))) throw new Error("Local image selection is unavailable");
      const task=this.hiddenWrites.then(async()=>{
        const hidden=new Set([...this.hiddenIds,...ids]);
        await mkdir(this.dataDir,{recursive:true});
        const file=path.join(this.dataDir,"hidden-image-ids.json"), temporary=`${file}.${randomUUID()}.tmp`;
        await writeFile(temporary,JSON.stringify([...hidden]),{mode:0o600});
        await rename(temporary,file);
        this.hiddenIds=hidden;
        return {hiddenIds:ids};
      });
      this.hiddenWrites=task.catch(()=>{});
      return task;
    }
    if (["reference", "register", "upload-file", "begin-upload"].includes(operation)) {
      const {accountId,userId,libraryFileId,fingerprint} = payload;
      if (![accountId,userId].every(value => typeof value === "string" && /^[\w-]{1,128}$/.test(value))) throw new Error("Invalid Library account");
      if (!this.dataDir) throw new Error("Local image references require a data directory");
      const image = this.library.get(id);
      if (!image) throw new Error("Local image is unavailable");
      // 只读取索引中的图片；内容变化后不沿用旧云端身份。
      const bytes = await readFile(image.sourcePath);
      const digest = createHash("sha256").update(bytes).digest("hex");
      const key = createHash("sha256").update(JSON.stringify([accountId,userId,id,digest])).digest("hex");
      const directory = path.join(this.dataDir,"cloud-image-references");
      const file = path.join(directory,`${key}.json`);
      if (operation === "begin-upload") {
        if (fingerprint !== digest) throw new Error("Local image content changed");
        await mkdir(directory,{recursive:true});
        try {await writeFile(file,JSON.stringify({status:"uploading"}),{flag:"wx",mode:0o600});}
        catch(error) {if(error.code==="EEXIST") return {started:false};throw error;}
        return {started:true};
      }
      if (operation === "register") {
        if (fingerprint !== digest || !/^libfile_[\w-]{1,128}$/.test(libraryFileId ?? "")) throw new Error("Invalid Library image reference");
        await mkdir(directory,{recursive:true});
        const temporary = `${file}.${randomUUID()}.tmp`;
        await writeFile(temporary,JSON.stringify({libraryFileId}),{mode:0o600});
        await rename(temporary,file);
        return {libraryFileId,fingerprint:digest};
      }
      if (operation === "upload-file") return {fingerprint:digest,name:path.basename(image.sourcePath),base64:bytes.toString("base64")};
      let reference;
      try {reference=JSON.parse(await readFile(file,"utf8"));} catch(error) {if(error.code!=="ENOENT") throw error;}
      return {libraryFileId:reference?.libraryFileId ?? null,status:reference?.status ?? "ready",fingerprint:digest};
    }
    if (operation === "prompt") {
      const image = await this.library.hydratePrompt(id);
      return image?.prompt?.trim() ? {text: image.prompt, kind: "generation"} : null;
    }
    const images=this.hiddenIds.size ? this.library.list({query}).filter(image=>!this.hiddenIds.has(image.id)) : null;
    return {
      images:(images ? images.slice(offset,offset+36) : this.library.list({limit:36,offset,query})).map(image=>this.image(image)),
      total:images ? images.length : this.library.count({query}),
    };
  }

  async close() {
    this.closed = true;
    await this.starting?.catch(() => {});
    await this.hiddenWrites;
    this.library.close();
  }
}
