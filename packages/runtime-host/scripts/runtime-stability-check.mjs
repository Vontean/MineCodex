#!/usr/bin/env node

const port = Number(process.argv[2] ?? 9231);

async function findMainTarget() {
  const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
  return targets.find((target) => target.type === "page" && target.url === "app://-/index.html");
}

async function connect(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let nextId = 1;
  let closed = false;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("close", () => { closed = true; });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  return {
    socket,
    isClosed: () => closed,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function readState(client) {
  const response = await client.send("Runtime.evaluate", {
    expression: `({
      timeOrigin: performance.timeOrigin,
      runtimeVersion: window.__codexPersonalRuntime?.version ?? null,
      featureEntries: document.querySelectorAll("[data-codex-personal-feature]").length,
      legacyEntries: document.querySelectorAll("[data-codex-image-host-entry]").length
    })`,
    returnByValue: true,
  });
  return response.result.value;
}

const firstTarget = await findMainTarget();
if (!firstTarget?.webSocketDebuggerUrl) throw new Error("Codex main Target was not found");
const client = await connect(firstTarget.webSocketDebuggerUrl);

try {
  await client.send("Runtime.enable");
  const before = await readState(client);
  await new Promise((resolve) => setTimeout(resolve, 2_500));
  if (client.isClosed()) throw new Error("Codex main Target was reloaded during the stability window");
  const after = await readState(client);
  const secondTarget = await findMainTarget();
  const result = {
    ok: firstTarget.id === secondTarget?.id
      && before.timeOrigin === after.timeOrigin
      && after.runtimeVersion === before.runtimeVersion
      && after.runtimeVersion !== null
      && after.featureEntries === before.featureEntries
      && after.featureEntries >= 1
      && after.legacyEntries === 0,
    targetId: firstTarget.id,
    before,
    after,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
} finally {
  client.socket.close();
}
