import { rename, unlink, writeFile } from "node:fs/promises";

export function createManagedPidFileWriter(
  filePath,
  {
    writeFileImpl = writeFile,
    renameImpl = rename,
    unlinkImpl = unlink,
    temporaryPath = `${filePath}.${process.pid}.tmp`,
  } = {},
) {
  return async (pid) => {
    if (!filePath) return;
    if (pid == null) {
      await unlinkImpl(filePath).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
      return;
    }
    await writeFileImpl(temporaryPath, `${pid}\n`, { mode: 0o600 });
    await renameImpl(temporaryPath, filePath);
  };
}
