import { execFile } from "node:child_process";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const SAVE_DIALOG_SCRIPT = `
on run argv
  try
    set destinationFile to choose file name with prompt "Save image as" default name (item 1 of argv)
    return POSIX path of destinationFile
  on error number -128
    return ""
  end try
end run
`;

export function defaultImageFilename(threadTitle) {
  const rawTitle = String(threadTitle || "Generated image").replace(/\.png$/i, "");
  const safeTitle = rawTitle
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+|\.+$/g, "")
    .trim()
    .slice(0, 96);
  return `${safeTitle || "Generated image"}.png`;
}

export async function saveImageAs(image) {
  const { stdout } = await run(
    "/usr/bin/osascript",
    ["-e", SAVE_DIALOG_SCRIPT, defaultImageFilename(image.threadTitle)],
    { encoding: "utf8" },
  );
  const destinationPath = stdout.trim();
  if (!destinationPath) return { saved: false, canceled: true };

  await copyFile(image.sourcePath, destinationPath);
  return { saved: true, fileName: path.basename(destinationPath) };
}
