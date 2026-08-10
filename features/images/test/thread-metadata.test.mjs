import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { ThreadMetadataIndex } from "../src/thread-metadata.mjs";

test("reads current Codex Project, Chat, and Thread names", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-thread-metadata-test-"));
  const stateDatabasePath = path.join(root, "state.sqlite");
  const globalStatePath = path.join(root, "global-state.json");
  const sessionIndexPath = path.join(root, "session-index.jsonl");
  const projectThreadId = "project-thread";
  const chatThreadId = "chat-thread";
  const projectRoot = "/workspace/codex-image-host";

  const database = new DatabaseSync(stateDatabasePath);
  database.exec("CREATE TABLE threads (id TEXT PRIMARY KEY, title TEXT, name TEXT, cwd TEXT, archived INTEGER)");
  database.prepare("INSERT INTO threads VALUES (?, ?, ?, ?, ?)")
    .run(projectThreadId, "Long initial project prompt", null, projectRoot, 0);
  database.prepare("INSERT INTO threads VALUES (?, ?, ?, ?, ?)")
    .run(chatThreadId, "Long initial chat prompt", null, "/tmp/new-chat", 1);
  database.close();

  await writeFile(globalStatePath, JSON.stringify({
    "projectless-thread-ids": [chatThreadId],
    "local-projects": {
      project: { id: "project", name: "CodexImageHost", rootPaths: [projectRoot] },
    },
    "thread-project-assignments": {
      [projectThreadId]: { projectKind: "local", projectId: "project", cwd: projectRoot },
    },
  }));
  await writeFile(sessionIndexPath, [
    JSON.stringify({ id: projectThreadId, thread_name: "Add image source labels" }),
    JSON.stringify({ id: chatThreadId, thread_name: "Generate a diagram" }),
  ].join("\n"));

  const index = new ThreadMetadataIndex({ stateDatabasePath, globalStatePath, sessionIndexPath });
  context.after(() => index.close());
  await index.refresh();

  assert.deepEqual(index.get(projectThreadId), {
    sourceKind: "project",
    projectId: "project",
    projectName: "CodexImageHost",
    threadTitle: "Add image source labels",
    archived: false,
  });
  assert.deepEqual(index.get(chatThreadId), {
    sourceKind: "chat",
    projectId: null,
    projectName: null,
    threadTitle: "Generate a diagram",
    archived: true,
  });

  await writeFile(sessionIndexPath, JSON.stringify({
    id: projectThreadId,
    thread_name: "Renamed task",
  }));
  await index.refresh();
  assert.equal(index.get(projectThreadId).threadTitle, "Renamed task");
});
