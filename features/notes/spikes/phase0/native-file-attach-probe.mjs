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
  const waiters = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }

    for (const waiter of waiters.get(message.method) ?? []) waiter.resolve(message.params);
    waiters.delete(message.method);
  });

  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  function waitFor(method, timeoutMs = 5_000) {
    return new Promise((resolve, reject) => {
      const waiter = { resolve: null, reject };
      const timeout = setTimeout(() => {
        const remaining = (waiters.get(method) ?? []).filter((item) => item !== waiter);
        if (remaining.length > 0) waiters.set(method, remaining);
        else waiters.delete(method);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      waiter.resolve = (value) => {
        clearTimeout(timeout);
        resolve(value);
      };
      const current = waiters.get(method) ?? [];
      current.push(waiter);
      waiters.set(method, current);
    });
  }

  return { socket, send, waitFor };
}

async function evaluate(send, expression, options = {}) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    ...options,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function clickAt(send, point) {
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
}

async function getVisibleCenter(send, expression, notFoundReason) {
  const point = await evaluate(
    send,
    `(() => {
      const element = ${expression};
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`,
  );
  if (!point) throw new Error(notFoundReason);
  return point;
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
  await new Promise((resolve) => setTimeout(resolve, 120));
  await client.send("Page.setInterceptFileChooserDialog", { enabled: true });

  blockerDisabled = await evaluate(
    client.send,
    `(() => {
      const add = document.querySelector('button[aria-label="Add files and more"]');
      if (!add) return false;
      const rect = add.getBoundingClientRect();
      const top = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      const blocker = top?.tagName === "IFRAME" && !add.contains(top)
        ? top.closest("section") ?? top
        : null;
      if (!blocker) return false;
      blocker.dataset.codexnotesPhase0Display = blocker.style.display;
      blocker.dataset.codexnotesPhase0Hidden = "true";
      blocker.style.display = "none";
      return true;
    })()`,
  );

  await client.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 53,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 53,
  });

  const addOpened = await evaluate(
    client.send,
    `(async () => {
      const add = document.querySelector('button[aria-label="Add files and more"]');
      if (!add) return false;
      add.click();
      await new Promise((resolve) => setTimeout(resolve, 180));
      return add.getAttribute("aria-expanded") === "true";
    })()`,
  );
  if (!addOpened) throw new Error("Add files trigger did not open");

  const addState = await evaluate(
    client.send,
    `(() => {
      const add = document.querySelector('button[aria-label="Add files and more"]');
      const rect = add?.getBoundingClientRect();
      const point = rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : null;
      return {
        expanded: add?.getAttribute("aria-expanded") ?? null,
        state: add?.getAttribute("data-state") ?? null,
        topAtPoint: point
          ? document.elementFromPoint(point.x, point.y)?.outerHTML.slice(0, 240)
          : null,
        visibleActions: Array.from(document.querySelectorAll("button"))
          .map((button) => button.innerText?.trim())
          .filter(Boolean)
          .filter((text) => /Files|folders|Photo|Screenshot|connect/i.test(text)),
      };
    })()`,
  );

  const filesActionFound = await evaluate(
    client.send,
    `Boolean(Array.from(document.querySelectorAll("button"))
      .find((button) => button.innerText?.trim() === "Files and folders"))`,
  );
  if (!filesActionFound) {
    throw new Error(`Files and folders action was not found: ${JSON.stringify(addState)}`);
  }
  const chooserOpened = client.waitFor("Page.fileChooserOpened", 8_000);
  const actionFocused = await evaluate(
    client.send,
    `(() => {
      const item = Array.from(document.querySelectorAll("button"))
        .find((button) => button.innerText?.trim() === "Files and folders");
      if (!item) return false;
      item.focus();
      return document.activeElement === item;
    })()`,
  );
  if (!actionFocused) throw new Error("Files and folders action could not receive focus");
  await client.send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 36,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 36,
  });

  const chooser = await chooserOpened;
  await client.send("DOM.setFileInputFiles", {
    files: [filePath],
    backendNodeId: chooser.backendNodeId,
  });

  await new Promise((resolve) => setTimeout(resolve, 700));
  const fileName = path.basename(filePath);
  const snapshot = await evaluate(
    client.send,
    `(() => {
      const fileName = ${JSON.stringify(fileName)};
      const composer = document.querySelector('[data-codex-composer="true"]');
      const composerRoot = composer?.closest("form") ?? composer?.parentElement?.parentElement?.parentElement;
      const matches = Array.from(document.querySelectorAll("*"))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return element.children.length === 0
            && element.textContent?.trim() === fileName
            && rect.width > 0
            && rect.height > 0;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName,
            text: element.textContent.trim(),
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            inComposer: Boolean(composerRoot?.contains(element)),
            parentText: element.parentElement?.innerText?.trim().slice(0, 180) ?? null,
          };
        });
      return {
        fileName,
        attached: matches.some((match) => match.inComposer),
        matches,
        composerText: composer?.innerText ?? "",
        sendDisabled: document.querySelector('button[aria-label="Send"]')?.disabled ?? null,
      };
    })()`,
  );

  process.stdout.write(`${JSON.stringify({
    ok: snapshot.attached,
    chooser: { mode: chooser.mode, hasBackendNode: Boolean(chooser.backendNodeId) },
    snapshot,
  }, null, 2)}\n`);
  if (!snapshot.attached) process.exitCode = 1;
} finally {
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
  await client.send("Page.setInterceptFileChooserDialog", { enabled: false }).catch(() => {});
  client.socket.close();
}
