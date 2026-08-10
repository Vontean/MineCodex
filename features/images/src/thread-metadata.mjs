import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function parseSessionIndex(text) {
  const names = new Map();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const entry = JSON.parse(line);
    if (entry.id && entry.thread_name) names.set(entry.id, entry.thread_name);
  }
  return names;
}

function projectContaining(projects, cwd) {
  if (!cwd) return null;
  return projects
    .flatMap((project) => (project.rootPaths ?? []).map((rootPath) => ({ project, rootPath })))
    .filter(({ rootPath }) => cwd === rootPath || cwd.startsWith(`${rootPath}${path.sep}`))
    .sort((left, right) => right.rootPath.length - left.rootPath.length)[0]?.project ?? null;
}

export class ThreadMetadataIndex {
  constructor({ stateDatabasePath, globalStatePath, sessionIndexPath }) {
    this.stateDatabasePath = stateDatabasePath;
    this.globalStatePath = globalStatePath;
    this.sessionIndexPath = sessionIndexPath;
    this.database = null;
    this.threadNames = new Map();
    this.projectlessThreadIds = new Set();
    this.projects = new Map();
    this.projectAssignments = {};
    this.refreshPromise = null;
  }

  async refresh() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const [globalStateText, sessionIndexText] = await Promise.all([
        readFile(this.globalStatePath, "utf8"),
        readFile(this.sessionIndexPath, "utf8"),
      ]);
      const globalState = JSON.parse(globalStateText);
      this.threadNames = parseSessionIndex(sessionIndexText);
      this.projectlessThreadIds = new Set(globalState["projectless-thread-ids"] ?? []);
      this.projects = new Map(
        Object.entries(globalState["local-projects"] ?? {})
          .map(([projectId, project]) => [projectId, { ...project, id: project.id ?? projectId }]),
      );
      this.projectAssignments = globalState["thread-project-assignments"] ?? {};
      this.database ??= new DatabaseSync(this.stateDatabasePath, { readOnly: true });
    })();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  get(threadId) {
    const thread = this.database
      ?.prepare("SELECT title, name, cwd, archived FROM threads WHERE id = ?")
      .get(threadId);
    if (!thread) return null;

    const threadTitle = this.threadNames.get(threadId) ?? thread.name ?? thread.title ?? "Untitled task";
    if (this.projectlessThreadIds.has(threadId)) {
      return {
        sourceKind: "chat",
        projectId: null,
        projectName: null,
        threadTitle,
        archived: Boolean(thread.archived),
      };
    }

    const assignment = this.projectAssignments[threadId];
    const assignedProject = assignment?.projectId ? this.projects.get(assignment.projectId) : null;
    const inferredProject = assignedProject ?? projectContaining([...this.projects.values()], thread.cwd);
    return {
      sourceKind: "project",
      projectId: inferredProject?.id ?? assignment?.projectId ?? null,
      projectName: inferredProject?.name ?? path.basename(thread.cwd),
      threadTitle,
      archived: Boolean(thread.archived),
    };
  }

  close() {
    this.database?.close();
    this.database = null;
  }
}
