import { createCloudImageActions } from "./frontend/cloud-image-actions.mjs";
import { createImageSourcesAdapter } from "./adapters/codex/image-sources.mjs";
import { createNativeImageSource } from "./adapters/codex/native-image-source.mjs";
import { installLocalImageSource } from "./frontend/local-image-source.mjs";
import { createLibraryApi } from "./adapters/codex/library-api.mjs";
import { createLibraryViewerAdapter } from "./adapters/codex/library-viewer.mjs";
import { readFile } from "node:fs/promises";
import { promptResolverSource } from "./adapters/codex/prompt-resolver-source.mjs";

export async function createPageScriptSource() {
  const source=await readFile(new URL("./library-prompt-page.mjs",import.meta.url),"utf8");
  const functions={createCloudImageActions,createImageSourcesAdapter,createNativeImageSource,installLocalImageSource,createLibraryApi,createLibraryViewerAdapter};
  const declarations=Object.entries(functions).map(([name,fn])=>`const ${name}=${fn.toString()};`).join("\n");
  return `${declarations}
let localImageSource=null;
const promptFromConversation=${promptResolverSource()};
${source.replace("const observer =", "localImageSource=installLocalImageSource(config,signal,createImageSourcesAdapter(config.codex),createNativeImageSource(config.codex,{requestHostAction:config.requestHostAction,libraryApi:createLibraryApi(),createCloudImageActions}));\nconst observer =").replace("return cleanup;", "return () => { cleanup(); localImageSource.cleanup(); };")}`;
}
