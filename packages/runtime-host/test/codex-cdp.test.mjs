import assert from "node:assert/strict";
import test from "node:test";
import { connect } from "../src/codex-cdp.mjs";

function mockSocket(t, { opens = true } = {}) {
  const OriginalWebSocket = globalThis.WebSocket;
  class Socket extends EventTarget {
    static OPEN = 1;
    readyState = 1;
    sent = [];
    constructor() {
      super();
      if (opens) queueMicrotask(() => this.dispatchEvent(new Event("open")));
    }
    send(value) { this.sent.push(JSON.parse(value)); }
    respond(id, result) {
      this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ id, result }) }));
    }
    close() {
      this.readyState = 3;
      this.dispatchEvent(new Event("close"));
    }
  }
  globalThis.WebSocket = Socket;
  t.after(() => { globalThis.WebSocket = OriginalWebSocket; });
}

test("rejects requests after the socket closes instead of blocking refresh forever", async (t) => {
  mockSocket(t);
  const client = await connect("ws://fixture");
  const pending = client.send("Runtime.evaluate");
  const rejected = assert.rejects(pending, /CDP WebSocket closed/);
  client.socket.close();
  await rejected;
  await assert.rejects(client.send("Runtime.evaluate"), /CDP WebSocket is not open/);
});

test("times out stalled requests, ignores late replies, and permits subsequent requests without replay", async (t) => {
  mockSocket(t);
  const client = await connect("ws://fixture");
  await assert.rejects(client.send("Runtime.evaluate", {}, { timeoutMs: 5 }), /request timed out/);
  assert.equal(client.socket.sent.length, 1);
  client.socket.respond(1, { stale: true });
  const next = client.send("Runtime.evaluate");
  client.socket.respond(2, { fresh: true });
  assert.deepEqual(await next, { fresh: true });
  assert.equal(client.socket.sent.length, 2);
  client.socket.close();
});

test("bounds websocket connection setup", async (t) => {
  mockSocket(t, { opens: false });
  await assert.rejects(connect("ws://fixture", { timeoutMs: 5 }), /connection timed out/);
});
