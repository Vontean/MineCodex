import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RELEASE_VERSION } from "./version.mjs";
const execute = promisify(execFile);

export async function installPlugin({ paths, execFileImpl = execute, codex = "codex", node = process.execPath }) {
  const root = path.join(paths.supportDir, "plugin-marketplace");
  const plugin = path.join(root, "plugins/minecodex");
  await mkdir(path.join(plugin, ".codex-plugin"), { recursive: true });
  await mkdir(path.join(plugin, "assets"), { recursive: true });
  await mkdir(path.join(root, ".agents/plugins"), { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(paths.packageRoot, "packages/plugin/plugin.json"), "utf8"));
  manifest.version = RELEASE_VERSION;
  await writeFile(path.join(plugin, ".codex-plugin/plugin.json"), JSON.stringify(manifest, null, 2) + "\n");
  await copyFile(path.join(paths.packageRoot, "assets/brand/minecodex-icon.svg"), path.join(plugin, "assets/icon.svg"));
  await writeFile(path.join(plugin, ".mcp.json"), JSON.stringify({ mcpServers: { minecodex: {
    command: node, args: [path.join(paths.packageRoot, "packages/cli/bin/mcx.mjs"), "plugin", "serve"],
  } } }, null, 2) + "\n");
  await writeFile(path.join(root, ".agents/plugins/marketplace.json"), JSON.stringify({
    name: "minecodex-local", interface: { displayName: "MineCodex" },
    plugins: [{ name: "minecodex", source: { source: "local", path: "./plugins/minecodex" }, policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" } }],
  }, null, 2) + "\n");
  await execFileImpl(codex, ["plugin", "marketplace", "add", root, "--json"]);
  const result = await execFileImpl(codex, ["plugin", "add", "minecodex@minecodex-local", "--json"]);
  return { root, result: JSON.parse(result.stdout) };
}
