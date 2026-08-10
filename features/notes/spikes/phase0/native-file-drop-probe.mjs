#!/usr/bin/env node

import path from "node:path";
import { access } from "node:fs/promises";

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

const port = Number(readArg("--port", "9231"));
const filePath = path.resolve(readArg("--file", "PRD.md"));
await access(filePath);

async function getTarget() {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`CDP discovery failed: HTTP ${response.status}`);
  const targets = await response.json();
  const target = targets.find(
    (candidate) => candidate.type === "page" && candidate.url === "app://-/index.html",
  );
  if (!target?.webSocketDebuggerUrl) throw new Error("Codex Renderer target was not found");
  return target;
}

async function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  return { socket, send };
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result?.value;
}

const target = await getTarget();
const client = await connect(target.webSocketDebuggerUrl);
let blockerDisabled = false;

try {
  await Promise.all([
    client.send("Runtime.enable"),
    client.send("Page.enable"),
    client.send("DOM.enable"),
  ]);
  await client.send("Page.bringToFront");

  const targetPoint = await evaluate(
    client.send,
    `(() => {
      const composer = document.querySelector('[data-codex-composer="true"]');
      if (!composer) return null;
      const rect = composer.getBoundingClientRect();
      const x = rect.left + Math.min(rect.width / 2, 220);
      const y = rect.top + Math.min(rect.height / 2, 32);
      const top = document.elementFromPoint(x, y);
      const blocker = top?.tagName === "IFRAME" && !composer.contains(top)
        ? top.closest("section") ?? top
        : null;
      if (blocker) {
        blocker.dataset.codexnotesPhase0Display = blocker.style.display;
        blocker.dataset.codexnotesPhase0Hidden = "true";
        blocker.style.display = "none";
      }
      const updatedRect = composer.getBoundingClientRect();
      return {
        x: updatedRect.left + Math.min(updatedRect.width / 2, 220),
        y: updatedRect.top + Math.min(updatedRect.height / 2, 32),
        blockerDisabled: Boolean(blocker),
      };
    })()`,
  );
  if (!targetPoint) throw new Error("Composer drop target was not found");
  blockerDisabled = targetPoint.blockerDisabled;

  await evaluate(
    client.send,
    `(() => {
      window.__codexnotesDragEvents = [];
      for (const type of ["dragenter", "dragover", "drop"]) {
        document.addEventListener(type, (event) => {
          window.__codexnotesDragEvents.push({
            type,
            trusted: event.isTrusted,
            target: event.target?.outerHTML?.slice(0, 180) ?? null,
            files: Array.from(event.dataTransfer?.files ?? []).map((file) => ({
              name: file.name,
              type: file.type,
              size: file.size,
            })),
            items: Array.from(event.dataTransfer?.items ?? []).map((item) => ({
              kind: item.kind,
              type: item.type,
            })),
            defaultPrevented: event.defaultPrevented,
          });
        }, true);
      }
    })()`,
  );

  await evaluate(
    client.send,
    `(() => {
      document.querySelector('[data-codexnotes-phase0-file-input]')?.remove();
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.dataset.codexnotesPhase0FileInput = "true";
      input.style.display = "none";
      document.body.append(input);
    })()`,
  );
  const { root } = await client.send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: "[data-codexnotes-phase0-file-input]",
  });
  if (!nodeId) throw new Error("Phase 0 file input could not be resolved through CDP");
  await client.send("DOM.setFileInputFiles", { files: [filePath], nodeId });

  const dropDispatched = await evaluate(
    client.send,
    `(() => {
      const composer = document.querySelector('[data-codex-composer="true"]');
      const input = document.querySelector('[data-codexnotes-phase0-file-input]');
      if (!composer || !input?.files?.length) return null;
      const transfer = new DataTransfer();
      for (const file of input.files) transfer.items.add(file);
      for (const type of ["dragenter", "dragover", "drop"]) {
        composer.dispatchEvent(new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: ${JSON.stringify(targetPoint.x)},
          clientY: ${JSON.stringify(targetPoint.y)},
          dataTransfer: transfer,
        }));
      }
      return Array.from(transfer.files).map((file) => ({
        name: file.name,
        type: file.type,
        size: file.size,
      }));
    })()`,
  );
  if (!dropDispatched?.length) throw new Error("Synthetic file drop could not be dispatched");
  await new Promise((resolve) => setTimeout(resolve, 900));

  const fileName = path.basename(filePath);
  const snapshot = await evaluate(
    client.send,
    `(() => {
      const fileName = ${JSON.stringify(fileName)};
      const composer = document.querySelector('[data-codex-composer="true"]');
      const candidates = Array.from(document.querySelectorAll("*"))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return element.children.length === 0
            && element.textContent?.trim() === fileName
            && rect.width > 0
            && rect.height > 0;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          let ancestor = element;
          const controls = [];
          for (let depth = 0; ancestor && depth < 5; depth += 1) {
            controls.push(...Array.from(ancestor.querySelectorAll("button")).map((button) => ({
              aria: button.getAttribute("aria-label"),
              title: button.getAttribute("title"),
              text: button.innerText?.trim() ?? "",
            })));
            ancestor = ancestor.parentElement;
          }
          return {
            tag: element.tagName,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            controls,
          };
        });
      return {
        attached: candidates.length > 0,
        candidates,
        dragEvents: window.__codexnotesDragEvents ?? [],
        composerText: composer?.innerText ?? "",
        sendDisabled: document.querySelector('button[aria-label="Send"]')?.disabled ?? null,
      };
    })()`,
  );

  const cleanup = args.includes("--keep") || !snapshot.attached
    ? { attempted: false, removed: false }
    : await evaluate(
      client.send,
      `(() => {
        const remove = document.querySelector(${JSON.stringify(
          `button[aria-label="Remove ${fileName}"]`,
        )});
        if (!remove) return { attempted: true, removed: false };
        remove.click();
        return { attempted: true, removed: true };
      })()`,
    );
  if (cleanup.removed) await new Promise((resolve) => setTimeout(resolve, 180));

  process.stdout.write(`${JSON.stringify({
    ok: snapshot.attached,
    seam: "DOM.setFileInputFiles + Composer drop -> native attachment",
    filePath,
    targetPoint,
    snapshot,
    cleanup,
  }, null, 2)}\n`);
  if (!snapshot.attached) process.exitCode = 1;
} finally {
  await evaluate(
    client.send,
    `document.querySelector('[data-codexnotes-phase0-file-input]')?.remove()`,
  ).catch(() => {});
  if (blockerDisabled) {
    await evaluate(
      client.send,
      `(() => {
        const blocker = document.querySelector('[data-codexnotes-phase0-hidden="true"]');
        if (!blocker) return;
        blocker.style.display = blocker.dataset.codexnotesPhase0Display ?? "";
        delete blocker.dataset.codexnotesPhase0Display;
        delete blocker.dataset.codexnotesPhase0Hidden;
      })()`,
    ).catch(() => {});
  }
  client.socket.close();
}
