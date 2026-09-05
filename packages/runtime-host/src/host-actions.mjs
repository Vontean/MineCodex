// Host action 命令：Codex Composer 的文件附件、图片编辑线程与降级路径。
// 每个命令是参数注入的纯函数（client 与依赖由 CodexRuntime 传入），
// CodexRuntime 只做 handleBindingCalled 路由，不再持有命令实现。

import { stat } from "node:fs/promises";
import path from "node:path";
import { CODEX_APP_ORIGIN } from "./codex-injection.mjs";
import {
  evaluationValue,
  waitForExpression,
} from "./codex-cdp.mjs";
export async function attachFileToComposer(client, filePath, requestId) {
  if (typeof filePath !== "string" || !path.isAbsolute(filePath)) {
    throw new Error("An absolute file path is required");
  }
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error("Only regular files can be attached");
  const fileName = path.basename(filePath);
  const marker = `codex-personal-${requestId}`;

  try {
    evaluationValue(await client.send("Runtime.evaluate", {
      expression: `(() => {
        document.querySelectorAll('[data-codex-personal-file-input]').forEach((input) => input.remove());
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.dataset.codexPersonalFileInput = ${JSON.stringify(marker)};
        input.style.display = "none";
        document.body.append(input);
        return true;
      })()`,
      returnByValue: true,
    }));
    const { root } = await client.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await client.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: `[data-codex-personal-file-input="${marker}"]`,
    });
    if (!nodeId) throw new Error("The temporary file bridge could not be resolved");
    await client.send("DOM.setFileInputFiles", { files: [filePath], nodeId });

    const attachment = evaluationValue(await client.send("Runtime.evaluate", {
      expression: `(async () => {
        const marker = ${JSON.stringify(marker)};
        const fileName = ${JSON.stringify(fileName)};
        const input = Array.from(document.querySelectorAll('[data-codex-personal-file-input]'))
          .find((candidate) => candidate.dataset.codexPersonalFileInput === marker);
        const composer = document.querySelector('[data-codex-composer="true"][contenteditable="true"]');
        if (!input?.files?.length || !composer) return { attached: false, reason: "Composer unavailable" };
        const transfer = new DataTransfer();
        for (const file of input.files) transfer.items.add(file);
        for (const type of ["dragenter", "dragover", "drop"]) {
          composer.dispatchEvent(new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            dataTransfer: transfer,
          }));
        }
        await new Promise((resolve) => setTimeout(resolve, 850));
        const attached = Boolean(document.querySelector(
          'button[aria-label=' + JSON.stringify('Remove ' + fileName) + ']'
        ));
        return { attached, reason: attached ? null : "Native attachment chip was not observed" };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    }));

    if (attachment?.attached) return { mode: "attach", name: fileName };
    const fallback = evaluationValue(await client.send("Runtime.evaluate", {
      expression: `window.__codexPersonalRuntime?.insertText(${JSON.stringify(filePath)})`,
      returnByValue: true,
    }));
    if (!fallback) throw new Error(attachment?.reason ?? "File attachment failed");
    return { mode: "insert-path", path: filePath, fallback: true };
  } finally {
    await client.send("Runtime.evaluate", {
      expression: `document.querySelectorAll('[data-codex-personal-file-input]').forEach((input) => input.remove())`,
    }).catch(() => {});
  }
}

export async function attachFilesToComposer(client, filePaths, requestId) {
  if (!Array.isArray(filePaths) || !filePaths.length || filePaths.length > 2) {
    throw new Error("One or two image edit attachments are required");
  }
  for (const filePath of filePaths) {
    if (typeof filePath !== "string" || !path.isAbsolute(filePath) || !(await stat(filePath)).isFile()) {
      throw new Error("Only absolute regular files can be attached");
    }
  }
  const fileNames = filePaths.map((filePath) => path.basename(filePath));
  const requiredLabels = fileNames.reduce((counts, fileName) => {
    const label = `Remove ${fileName}`;
    counts[label] = (counts[label] ?? 0) + 1;
    return counts;
  }, {});
  const marker = `codex-personal-${requestId}-batch`;

  try {
    evaluationValue(await client.send("Runtime.evaluate", {
      expression: `(() => {
        document.querySelectorAll('[data-codex-personal-file-input]').forEach((input) => input.remove());
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.dataset.codexPersonalFileInput = ${JSON.stringify(marker)};
        input.style.display = "none";
        document.body.append(input);
        return true;
      })()`,
      returnByValue: true,
    }));
    const { root } = await client.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await client.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: `[data-codex-personal-file-input="${marker}"]`,
    });
    if (!nodeId) throw new Error("The temporary multi-file bridge could not be resolved");
    await client.send("DOM.setFileInputFiles", { files: filePaths, nodeId });
    const dropped = evaluationValue(await client.send("Runtime.evaluate", {
      expression: `(() => {
        const input = document.querySelector(${JSON.stringify(`[data-codex-personal-file-input="${marker}"]`)});
        const composer = document.querySelector('[data-codex-composer="true"][contenteditable="true"]');
        if (!input?.files?.length || !composer) return false;
        const transfer = new DataTransfer();
        for (const file of input.files) transfer.items.add(file);
        for (const type of ["dragenter", "dragover", "drop"]) {
          composer.dispatchEvent(new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            dataTransfer: transfer,
          }));
        }
        return transfer.files.length === ${filePaths.length};
      })()`,
      returnByValue: true,
    }));
    if (!dropped) throw new Error("The native Composer rejected the image edit drop");
    await waitForExpression(client, `(() => {
      const required = ${JSON.stringify(requiredLabels)};
      const observed = {};
      for (const button of document.querySelectorAll('button[aria-label^="Remove "]')) {
        const label = button.getAttribute("aria-label");
        observed[label] = (observed[label] ?? 0) + 1;
      }
      return Object.entries(required).every(([label, count]) => (observed[label] ?? 0) >= count);
    })()`, 10_000);
    return fileNames.map((name) => ({ mode: "attach", name }));
  } finally {
    await client.send("Runtime.evaluate", {
      expression: `document.querySelectorAll('[data-codex-personal-file-input]').forEach((input) => input.remove())`,
    }).catch(() => {});
  }
}

export async function createImageEditThread(client, feature, payload, requestId, { fetchImpl, attachFiles = attachFilesToComposer } = {}) {
  const draftId = typeof payload?.draftId === "string" ? payload.draftId : "";
  const prompt = typeof payload?.prompt === "string" ? payload.prompt.trim() : "";
  if (!/^[a-f0-9-]{36}$/.test(draftId) || !prompt || prompt.length > 2_000 || !feature?.surfaceUrl) {
    throw Object.assign(new Error("The image edit request is incomplete"), { code: "INVALID_EDIT_REQUEST" });
  }
  const draftResponse = await fetchImpl(new URL(`/api/image-edit-draft/${draftId}`, feature.surfaceUrl), {
    headers: { Origin: CODEX_APP_ORIGIN },
  });
  if (!draftResponse?.ok) {
    throw Object.assign(new Error("The image edit draft is unavailable"), { code: "EDIT_DRAFT_UNAVAILABLE" });
  }
  const draft = await draftResponse.json();
  const paths = [draft?.sourcePath, draft?.auxiliaryPath].filter(Boolean);
  if (!paths.length || paths.length > 2) {
    throw Object.assign(new Error("The image edit attachments are unavailable"), { code: "INVALID_EDIT_ATTACHMENT" });
  }
  for (const filePath of paths) {
    if (typeof filePath !== "string" || !path.isAbsolute(filePath) || !(await stat(filePath)).isFile()) {
      throw Object.assign(new Error("The image edit attachment is unavailable"), { code: "INVALID_EDIT_ATTACHMENT" });
    }
  }

  const opened = evaluationValue(await client.send("Runtime.evaluate", {
    expression: `(() => {
      const candidates = Array.from(document.querySelectorAll('button, [role="button"]'));
      const trigger = candidates.find((element) => /^new chat$/i.test(
        (element.getAttribute('aria-label') || element.textContent || '').trim(),
      ));
      if (!trigger) return false;
      trigger.click();
      return true;
    })()`,
    returnByValue: true,
  }));
  if (!opened) throw Object.assign(new Error("The native New chat control is unavailable"), {
    code: "NEW_CHAT_UNAVAILABLE",
  });
  await waitForExpression(client, `Boolean(document.querySelector('[data-testid="home-icon"]')) && Boolean(document.querySelector('[data-codex-composer="true"][contenteditable="true"]'))`);
  const attached = await attachFiles(client, paths, requestId);
  evaluationValue(await client.send("Runtime.evaluate", {
    expression: `window.__codexPersonalRuntime?.insertText(${JSON.stringify(prompt)})`,
    returnByValue: true,
  }));
  const sent = evaluationValue(await client.send("Runtime.evaluate", {
    expression: `(() => {
      const send = document.querySelector('button[aria-label="Send message"]')
        || document.querySelector('button[aria-label="Send"]')
        || document.querySelector('button[data-testid="send-button"]');
      if (!send || send.disabled) return false;
      send.click();
      return true;
    })()`,
    returnByValue: true,
  }));
  if (!sent) throw Object.assign(new Error("The new Chat is ready but its Send button is unavailable"), {
    code: "SEND_UNAVAILABLE",
  });
  await waitForExpression(client, `!document.querySelector('[data-testid="home-icon"]') && Boolean(document.querySelector('[data-codex-composer="true"][contenteditable="true"]'))`);
  return { attached, threadStarted: true };
}

