import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { stdout } = await execFileAsync(
  "npm",
  ["pack", "--dry-run", "--json", "--ignore-scripts"],
  {
    cwd: root,
    env: {
      ...process.env,
      npm_config_cache: process.env.MINECODEX_NPM_CACHE ?? "/tmp/minecodex-npm-cache",
    },
    maxBuffer: 16 * 1024 * 1024,
  },
);

const [report] = JSON.parse(stdout);
if (!report || report.name !== "minecodex") {
  throw new Error("npm pack did not return the MineCodex package report");
}

const packageMetadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (packageMetadata.license !== "MIT") {
  throw new Error("package.json must declare the approved MIT license");
}

const files = report.files.map(({ path: filePath }) => filePath).sort();
const requiredFiles = [
  "features/sites/codex-feature.json",
  "features/sites/src/frontend/entry.mjs",
  "features/sites/src/backend/sites-service.mjs",
  "LICENSE",
  "README.md",
  "apps/dashboard/index.html",
  "features/images/codex-feature.json",
  "features/hide-upsell-banner/codex-feature.json",
  "features/model-slider/THIRD_PARTY_NOTICES.md",
  "features/model-slider/codex-feature.json",
  "features/model-slider/src/injection-source.mjs",
  "features/model-slider/src/domain/model-rules.mjs",
  "features/model-slider/src/frontend/install.mjs",
  "features/model-slider/vendor/cc-switch-LICENSE",
  "features/model-slider/vendor/lucide-LICENSE",
  "features/notes/codex-feature.json",
  "features/notes/src/frontend/entry.mjs",
  "features/notes/src/backend/quick-prompts-server.mjs",
  "features/notes/assets/native-prompt-icons.json",
  "features/notes/assets/native-emojis.json",
  "features/notes/assets/icons/book-open.svg",
  "features/session-status/codex-feature.json",
  "features/session-status/src/session-status.mjs",
  "features/usage-meter/codex-feature.json",
  "features/usage-meter/src/usage-meter.mjs",
  "package.json",
  "packages/cli/bin/mcx.mjs",
  "packages/cli/native/MineCodex.app/Contents/Info.plist",
  "packages/cli/native/MineCodex.app/Contents/Library/LaunchAgents/com.vontean.minecodex.background.plist",
  "packages/cli/native/MineCodex.app/Contents/MacOS/MineCodexServiceManager",
  "packages/cli/native/MineCodex.app/Contents/Resources/MineCodexServiceHost",
  "packages/runtime-host/src/main.mjs",
  "packages/ui/src/install.mjs",
  "packages/ui/src/native/tokens.mjs",
  "packages/ui/src/foundation/surfaces.mjs",
  "packages/ui/src/foundation/layers.mjs",
  "packages/ui/src/components/dialog.mjs",
  "packages/ui/src/components/button.mjs",
  "packages/ui/src/components/tooltip.mjs",
  "packages/ui/src/components/page.mjs",
  "packages/ui/src/components/composer-menu.mjs",
  "features/notes/src/frontend/styles.css",
  "features/notes/src/frontend/icons.json",
  "features/sites/src/frontend/styles.css",
  "features/sites/src/frontend/icons.json",
  "features/session-status/src/adapters/codex/session-reader.mjs",
  "features/session-status/src/domain/session-stats.mjs",
  "features/images/src/backend/cloud-library.mjs",
  "features/images/src/domain/library-prompt.mjs",
  "features/images/src/library-prompt-source.mjs",
  "features/sites/src/domain/site.mjs",
  "DESIGN.md",
];

const forbiddenPaths = [
  [/(^|\/)(?:test|tests|__tests__|fixtures|coverage)(\/|$)/i, "test or coverage content"],
  [/(^|\/)(?:node_modules|\.git|\.github|\.codex|\.agents|\.claude|\.cursor|\.idea|\.vscode)(\/|$)/i, "development or personal configuration"],
  [/(^|\/)(?:\.impeccable|\.playwright-cli|output|dist)(\/|$)/i, "build or tool output"],
  [/(^|\/)(?:config|settings|preferences)\.(?:json|toml|ya?ml)$/i, "personal settings"],
  [/(^|\/)\.env(?:\.|$)/i, "environment configuration"],
  [/\.(?:log|sqlite3?|db|pem|key|p12|mobileprovision|tgz)$/i, "logs, local data, credentials, or archives"],
  [/(^|\/)\.DS_Store$/i, "macOS metadata"],
];

const sensitiveContent = [
  [/\/Users\/[A-Za-z0-9._-]+\//, "absolute macOS user path"],
  [/\/home\/[A-Za-z0-9._-]+\//, "absolute Unix user path"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
  [/\bnpm_[A-Za-z0-9]{20,}\b/, "npm access token"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/, "GitHub access token"],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/, "API key"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
];

const failures = [];
for (const required of requiredFiles) {
  if (!files.includes(required)) failures.push(`missing required file: ${required}`);
}

for (const filePath of files) {
  for (const [pattern, reason] of forbiddenPaths) {
    if (pattern.test(filePath)) failures.push(`${reason}: ${filePath}`);
  }

  const contents = await readFile(path.join(root, filePath));
  if (contents.includes(0)) continue;
  const text = contents.toString("utf8");
  for (const [pattern, reason] of sensitiveContent) {
    if (pattern.test(text)) failures.push(`${reason}: ${filePath}`);
  }
}

const infoPlist = await readFile(path.join(
  root,
  "packages/cli/native/MineCodex.app/Contents/Info.plist",
), "utf8");
if (!/<key>CFBundleDisplayName<\/key>\s*<string>MineCodex<\/string>/.test(infoPlist)) {
  failures.push("native background service must be displayed as MineCodex");
}

const launchAgent = await readFile(path.join(
  root,
  "packages/cli/native/MineCodex.app/Contents/Library/LaunchAgents/com.vontean.minecodex.background.plist",
), "utf8");
if (!/<key>BundleProgram<\/key>\s*<string>Contents\/Resources\/MineCodexServiceHost<\/string>/.test(launchAgent)) {
  failures.push("native background service must launch the MineCodex-owned host");
}
if (/ProgramArguments|node/i.test(launchAgent)) {
  failures.push("native background item must not be attributed to Node.js");
}

for (const binaryPath of [
  "packages/cli/native/MineCodex.app/Contents/MacOS/MineCodexServiceManager",
  "packages/cli/native/MineCodex.app/Contents/Resources/MineCodexServiceHost",
]) {
  const { stdout: stringsOutput } = await execFileAsync("/usr/bin/strings", [path.join(root, binaryPath)], {
    maxBuffer: 4 * 1024 * 1024,
  });
  for (const [pattern, reason] of sensitiveContent) {
    if (pattern.test(stringsOutput)) failures.push(`${reason}: ${binaryPath}`);
  }
}

if (failures.length) {
  throw new Error(`Package audit failed:\n- ${[...new Set(failures)].join("\n- ")}`);
}

console.log(
  `Package audit passed: ${report.id}, ${files.length} files, ${report.size} bytes, no tests, personal settings, private paths, credentials, logs, or local data.`,
);
