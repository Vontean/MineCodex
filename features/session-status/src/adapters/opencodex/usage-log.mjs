import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// OCX usage.jsonl 的数值投影；不读取配置、密钥或对话正文。
function usageRecord(row) {
  if (typeof row.requestId !== "string" || typeof row.conversationId !== "string"
    || !Number.isFinite(row.timestamp) || !Number.isFinite(row.durationMs) || row.durationMs < 0) return null;
  return { id:row.requestId, conversationId:row.conversationId, start:row.timestamp,
    end:row.timestamp+row.durationMs, duration:row.durationMs,
    usageStatus:row.usageStatus, input:row.usage?.inputTokens, cached:row.usage?.cachedInputTokens ?? 0,
    output:row.usage?.outputTokens };
}

function requestMeasurement(record) {
  const unavailable = reason => ({source:"ocx",output:record.output,elapsed:null,reason});
  if (record.usageStatus === "unsupported") return unavailable("usage_unsupported");
  if (!Number.isFinite(record.output) || record.output <= 0) return unavailable("output_missing");
  if (!Number.isFinite(record.duration) || record.duration <= 0) return unavailable("invalid_duration");
  return {source:"ocx",output:record.output,elapsed:record.duration,reason:null};
}

export class OpenCodexUsageReader {
  constructor(filePath=path.join(process.env.OPENCODEX_HOME?.trim() || path.join(os.homedir(),".opencodex"),"usage.jsonl")) {
    this.filePath=filePath;this.offset=0;this.pending="";this.identity=null;
    this.conversations=new Map();this.refreshing=null;
  }

  refresh() {
    if (!this.refreshing) this.refreshing=this.readAppend().finally(()=>{this.refreshing=null;});
    return this.refreshing;
  }

  async readAppend() {
    let file;
    try { file=await stat(this.filePath); }
    catch(error) {
      if (!["ENOENT","EACCES","EPERM"].includes(error.code)) throw error;
      this.offset=0;this.pending="";this.identity=null;this.conversations.clear();return;
    }
    const identity=`${file.dev}:${file.ino}`;
    if (identity !== this.identity || file.size < this.offset) {
      this.offset=0;this.pending="";this.conversations.clear();this.identity=identity;
    }
    if (file.size === this.offset) return;
    const stream=createReadStream(this.filePath,{start:this.offset,end:file.size-1,encoding:"utf8"});
    for await(const chunk of stream) {
      const lines=(this.pending+chunk).split("\n");this.pending=lines.pop() ?? "";
      for(const line of lines) {
        let record;
        try {record=usageRecord(JSON.parse(line));} catch {continue;}
        if (!record) continue;
        let records=this.conversations.get(record.conversationId);
        if (!records) this.conversations.set(record.conversationId,records=new Map());
        records.set(record.id,record);
      }
    }
    this.offset=file.size;
  }

  async measurements(threadId,samples) {
    await this.refresh();
    const conversationId=createHash("sha256").update(threadId).digest("hex").slice(0,32);
    const records=[...(this.conversations.get(conversationId)?.values() ?? [])];
    const candidates=new Map(),owners=new Map();
    for(const sample of samples) {
      // 同会话、完整用量相等且完成相邻才可关联；同一请求不能归属两个响应。
      const matches=records.filter(record=>Number.isFinite(record.input) && Number.isFinite(record.output)
        && record.input === sample.input && record.cached === sample.cached && record.output === sample.output
        && record.start <= sample.end && Math.abs(record.end-sample.end) <= 2000);
      if (matches.length !== 1) continue;
      const record=matches[0];candidates.set(sample.id,record);
      owners.set(record.id,(owners.get(record.id) ?? 0)+1);
    }
    return new Map([...candidates].filter(([,record])=>owners.get(record.id) === 1)
      .map(([id,record])=>[id,requestMeasurement(record)]));
  }
}
