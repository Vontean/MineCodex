import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ImageLibrary } from "./image-library.mjs";
import { createHttpServer } from "./http-server.mjs";
import { ThreadMetadataIndex } from "./thread-metadata.mjs";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = process.env.CODEX_IMAGE_HOST_DATA_DIR ?? path.join(os.homedir(), ".codex-image-host");
const sourceRoot = process.env.CODEX_IMAGEGEN_ROOT ?? path.join(os.homedir(), ".codex", "generated_images");
const codexRoot = path.join(os.homedir(), ".codex");
const sessionRoots = [
  process.env.CODEX_SESSION_ROOT ?? path.join(codexRoot, "sessions"),
  path.join(codexRoot, "archived_sessions"),
];
const port = Number(process.env.CODEX_IMAGE_HOST_PORT ?? 47831);
const threadMetadata = new ThreadMetadataIndex({
  stateDatabasePath: process.env.CODEX_STATE_DATABASE ?? path.join(codexRoot, "state_5.sqlite"),
  globalStatePath: process.env.CODEX_GLOBAL_STATE ?? path.join(codexRoot, ".codex-global-state.json"),
  sessionIndexPath: process.env.CODEX_SESSION_INDEX ?? path.join(codexRoot, "session_index.jsonl"),
});

const library = new ImageLibrary({ sourceRoot, dataDir, sessionRoots, threadMetadata });
const startup = await library.start();
const server = await createHttpServer({
  library,
  webDir: path.join(projectRoot, "web"),
  port,
});

console.log(`Images: ${startup.total} total, ${startup.imported} imported`);
console.log(`Library: ${server.url}`);

async function shutdown() {
  await server.close();
  library.close();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await shutdown();
    process.exit(0);
  });
}
