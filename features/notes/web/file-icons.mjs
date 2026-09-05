// Codex 文件类型图标规则：文件扩展名 / MIME 到 Codex file-* 图标的映射。
// 这是文件图标的单一事实来源；app.js 只负责渲染。

const CODEX_FILE_ICON_BY_EXTENSION = new Map([
  ["ts", "typescript"],
  ["tsx", "react"], ["jsx", "react"],
  ["js", "javascript"], ["mjs", "javascript"], ["cjs", "javascript"], ["hs", "javascript"],
  ["py", "python"],
  ["java", "java"],
  ["rs", "rust"],
  ["php", "php"],
  ["css", "css"], ["scss", "css"], ["less", "css"], ["sass", "css"],
  ["cpp", "cplusplus"], ["cxx", "cplusplus"], ["cc", "cplusplus"], ["c", "cplusplus"],
  ["hpp", "cplusplus"], ["hh", "cplusplus"], ["h", "cplusplus"],
  ["rb", "code"], ["go", "code"], ["kt", "code"], ["swift", "code"], ["m", "code"],
  ["mm", "code"], ["cs", "code"], ["sql", "code"],
  ["json", "json"], ["jsonc", "json"],
  ["md", "document"], ["mdx", "document"], ["markdown", "document"],
  ["mkd", "document"], ["mdown", "document"],
  ["html", "html"], ["htm", "html"],
  ["yaml", "file"], ["yml", "file"],
  ["toml", "toml"],
  ["xml", "document"],
  ["csv", "spreadsheet"], ["tsv", "spreadsheet"], ["xls", "spreadsheet"],
  ["xlsm", "spreadsheet"], ["xlsx", "spreadsheet"],
  ["doc", "artifact-document"], ["docx", "artifact-document"],
  ["ipynb", "notebook"],
  ["ppt", "presentation"], ["pptx", "presentation"],
  ["sh", "shell"], ["bash", "shell"], ["zsh", "shell"], ["fish", "shell"], ["ps1", "shell"],
  ["dockerfile", "terminal"],
  ["env", "document"], ["dotenv", "document"], ["gitignore", "document"], ["lock", "document"],
  ["png", "image"], ["jpg", "image"], ["jpeg", "image"], ["gif", "image"],
  ["webp", "image"], ["bmp", "image"], ["svg", "image"], ["ico", "image"],
  ["build", "build"], ["bazel", "build"], ["bzl", "build"], ["ninja", "build"],
  ["gradle", "build"], ["mk", "build"], ["makefile", "build"],
  ["sha", "hashes"], ["sha1", "hashes"], ["sha256", "hashes"],
  ["md5", "hashes"], ["checksum", "hashes"], ["sum", "hashes"],
  ["pdf", "pdf"],
  ["zip", "folder"], ["gz", "folder"], ["tgz", "folder"], ["tar", "folder"],
]);

const CODEX_COLOR_FILE_ICONS = new Set(["artifact-document", "pdf", "presentation", "spreadsheet"]);

export function codexFileIconKind(file) {
  const rawPath = String(file.path || file.name || "").toLowerCase();
  if (/[\\/]$/.test(rawPath)) return "folder";
  const name = rawPath.split(/[\\/]/).at(-1) || "";
  if (name === "skill.md") return "skill";
  const dot = name.lastIndexOf(".");
  const extension = dot > 0 && dot < name.length - 1
    ? name.slice(dot + 1)
    : dot === 0 && name.length > 1
      ? name.slice(1)
      : dot === -1
        ? name
        : null;
  const extensionKind = extension ? CODEX_FILE_ICON_BY_EXTENSION.get(extension) : null;
  if (extensionKind) return extensionKind;
  const mimeType = String(file.mimeType || "").toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("text/")) return "document";
  if (mimeType.startsWith("application/pdf")) return "pdf";
  if (mimeType.startsWith("application/zip") || mimeType.startsWith("application/gzip")) return "folder";
  return "file";
}


export { CODEX_COLOR_FILE_ICONS };
