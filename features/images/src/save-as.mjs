import { execFile } from "node:child_process";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const SAVE_DIALOG_SCRIPT = `
on run argv
  try
    set destinationFile to choose file name with prompt (item 2 of argv) default name (item 1 of argv)
    return POSIX path of destinationFile
  on error number -128
    return ""
  end try
end run
`;

// PowerShell 单引号字面量：内部单引号翻倍转义。
function psSingleQuoted(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function buildWindowsSaveDialogScript(fileName, title, chinese) {
  return [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "Add-Type -AssemblyName System.Windows.Forms | Out-Null",
    "$dialog = New-Object System.Windows.Forms.SaveFileDialog",
    "$dialog.Title = " + psSingleQuoted(title),
    "$dialog.FileName = " + psSingleQuoted(fileName),
    "$dialog.Filter = " + psSingleQuoted(chinese ? "PNG 图片 (*.png)|*.png" : "PNG image (*.png)|*.png"),
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.FileName) }",
  ].join("; ");
}

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

export async function saveImageAs(image, { locale = "en" } = {}) {
  const chinese = String(locale).toLowerCase().startsWith("zh");
  const title = chinese ? "图片另存为" : "Save image as";
  let destinationPath;
  if (process.platform === "win32") {
    const { stdout } = await run(
      "powershell.exe",
      ["-NoProfile", "-STA", "-Command", buildWindowsSaveDialogScript(defaultImageFilename(image.threadTitle), title, chinese)],
      { encoding: "utf8" },
    );
    destinationPath = stdout.trim();
  } else {
    const { stdout } = await run(
      "/usr/bin/osascript",
      ["-e", SAVE_DIALOG_SCRIPT, defaultImageFilename(image.threadTitle), title],
      { encoding: "utf8" },
    );
    destinationPath = stdout.trim();
  }
  if (!destinationPath) return { saved: false, canceled: true };

  await copyFile(image.sourcePath, destinationPath);
  return { saved: true, fileName: path.basename(destinationPath) };
}
