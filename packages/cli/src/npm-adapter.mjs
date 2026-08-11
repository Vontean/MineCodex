import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const defaultExecFile = promisify(execFileCallback);

export function createNpmAdapter({ execFile = defaultExecFile, tempRoot = os.tmpdir() } = {}) {
  return {
    async viewLatestVersion() {
      const { stdout } = await execFile("npm", ["view", "minecodex", "version"]);
      return stdout.trim();
    },

    async createRollbackArchive(packageRoot) {
      const directory = await mkdtemp(path.join(tempRoot, "minecodex-update-"));
      try {
        const { stdout } = await execFile("npm", ["pack", packageRoot, "--pack-destination", directory]);
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
      await execFile("npm", ["install", "-g", spec]);
    },

    async cleanup(rollback) {
      await rollback?.cleanup?.();
    },
  };
}
