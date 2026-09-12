import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const defaultExecFile = promisify(execFileCallback);

export function createNpmAdapter({ execFile = defaultExecFile, tempRoot = os.tmpdir(), platform = process.platform } = {}) {
  function runNpm(args) {
    if (platform !== "win32") return execFile("npm", args);
    // npm.cmd 需要命令解释器；字面量参数经编码传递，避免路径被当成脚本。
    const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
    const script = "[Console]::OutputEncoding=[Text.Encoding]::UTF8; $ErrorActionPreference='Stop'; & npm.cmd "
      + args.map(quote).join(" ") + "; exit $LASTEXITCODE";
    return execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")]);
  }
  return {
    async viewLatestVersion() {
      const { stdout } = await runNpm(["view", "minecodex", "version"]);
      return stdout.trim();
    },

    async createRollbackArchive(packageRoot) {
      const directory = await mkdtemp(path.join(tempRoot, "minecodex-update-"));
      try {
        const { stdout } = await runNpm(["pack", packageRoot, "--pack-destination", directory]);
        const archiveName = stdout.trim().split("\n").filter(Boolean).at(-1);
        if (!archiveName) throw new Error("Could not create a rollback archive for the installed MineCodex version.");
        return {
          archivePath: path.join(directory, archiveName),
          cleanup: () => rm(directory, { recursive: true, force: true }),
        };
      } catch (error) {
        await rm(directory, { recursive: true, force: true });
        throw error;
      }
    },

    async installGlobal(spec) {
      await runNpm(["install", "-g", spec]);
    },

    async cleanup(rollback) {
      await rollback?.cleanup?.();
    },
  };
}
