import { cloudImagesInRenderer } from "../adapters/codex/cloud-import.mjs";
import { createLibraryApi } from "../adapters/codex/library-api.mjs";
import { promptResolverSource } from "../adapters/codex/prompt-resolver-source.mjs";

export async function cloudImagesAction(evaluate, operation, payload = {}) {
  if (!["list", "import"].includes(operation)) throw new Error("Unknown cloud image operation");
  if (payload.cursor != null && (typeof payload.cursor !== "string" || payload.cursor.length > 4096)) throw new Error("Invalid Library cursor");
  if (operation === "import" && (typeof payload.libraryId !== "string" || !/^libfile_[\w-]+$/.test(payload.libraryId))) throw new Error("Invalid Library file ID");
  return evaluate(`(${cloudImagesInRenderer.toString()})(${JSON.stringify(operation)},${JSON.stringify(payload)},${promptResolverSource()},${createLibraryApi.toString()})`, { timeoutMs: 110_000 });
}
