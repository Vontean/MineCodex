import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

async function findThreadLogs(directory, threadId, output = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return output;
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await findThreadLogs(entryPath, threadId, output);
    else if (entry.isFile() && entry.name.endsWith(`${threadId}.jsonl`)) output.push(entryPath);
  }
  return output;
}

function promptFromEventLine(line, imageGenerationItemId) {
  if (!line.includes('"image_generation_end"') || !line.includes(imageGenerationItemId)) return null;
  const callId = line.match(/"call_id"\s*:\s*"([^"]+)"/)?.[1];
  if (callId !== imageGenerationItemId) return null;
  const promptLiteral = line.match(/"revised_prompt"\s*:\s*("(?:\\.|[^"\\])*")/)?.[1];
  if (!promptLiteral) return null;
  return JSON.parse(promptLiteral);
}

async function readPrompt(logPath, imageGenerationItemId) {
  const input = createReadStream(logPath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    const prompt = promptFromEventLine(line, imageGenerationItemId);
    if (prompt) return prompt;
  }
  return null;
}

export async function findImagePrompt({ sessionRoots, threadId, imageGenerationItemId }) {
  for (const sessionRoot of sessionRoots) {
    const logPaths = await findThreadLogs(sessionRoot, threadId);
    for (const logPath of logPaths) {
      const prompt = await readPrompt(logPath, imageGenerationItemId);
      if (prompt) return prompt;
    }
  }
  return null;
}
