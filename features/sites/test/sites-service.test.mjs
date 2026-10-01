import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { SitesService } from "../src/backend/sites-service.mjs";
import { normalizeSite, projectForDirectory } from "../src/domain/site.mjs";
import { parseListeners, probePage, localListeners } from "../src/backend/discovery.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "mcx-sites-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = path.join(root, "web"); await mkdir(project);
  await writeFile(path.join(root, ".codex-global-state.json"), JSON.stringify({ "local-projects": { project1: { name: "Website", rootPaths: [project] } } }));
  return { root, project, service: new SitesService({ codexHome: root, dataDir: path.join(root, "saved") }) };
}

test("URLs reject active schemes and embedded credentials; hosting is independent of source", () => {
  for (const url of ["javascript:alert(1)", "file:///tmp/a", "https://user:password@example.com"]) assert.throws(() => normalizeSite({ url, origin: { kind: "external" } }));
  assert.equal(normalizeSite({ url: "http://[::1]:3000", origin: { kind: "project", projectId: "p" } }).hosting, "local");
  assert.equal(normalizeSite({ url: "https://example.com", origin: { kind: "project", projectId: "p" } }).origin.kind, "project");
});

test("project attribution uses path boundaries and deepest root, including Windows casing", () => {
  const projects = [{ id: "parent", rootPaths: ["/work/web"] }, { id: "child", rootPaths: ["/work/web/nested"] }];
  assert.equal(projectForDirectory(projects, "/work/website"), null);
  assert.equal(projectForDirectory(projects, "/work/web/nested/src").id, "child");
  assert.equal(projectForDirectory([{ id: "win", rootPaths: ["C:\\Code\\Web"] }], "c:\\code\\web\\src", path.win32).id, "win");
});

test("listener parser deduplicates wildcard sockets and excludes non-loopback addresses", () => {
  assert.deepEqual(parseListeners("p42\ncnode\nn*:3000\nn[::]:3000\nn192.168.1.2:8080\np43\ncnode\nn[::1]:3001"), [
    { pid: 42, command: "node", port: 3000, url: "http://127.0.0.1:3000/" },
    { pid: 43, command: "node", port: 3001, url: "http://[::1]:3001/" },
  ]);
});

test("discovery probes only attributed project services, filters non-web responses and deduplicates", async t => {
  const { service, project } = await fixture(t); const probed = [];
  service.listeners = async () => [
    { cwd: project, command: "node web-server.js", url: "http://127.0.0.1:3000/" }, { cwd: project, command: "node web-server.js", url: "http://127.0.0.1:3000/" },
    { cwd: project, command: "node web-server.js", url: "http://127.0.0.1:3001/" }, { cwd: project + "-other", command: "node web-server.js", url: "http://127.0.0.1:9000/" },
  ];
  service.probe = async url => { probed.push(url); return url.includes("3000") ? { title: "Web app" } : null; };
  const result = await service.discover();
  assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].projectId, "project1");
  assert.deepEqual(probed.sort(), ["http://127.0.0.1:3000/", "http://127.0.0.1:3001/"]);
  assert.deepEqual(await service.read(), []);
});

test("HTML probe rejects APIs and redirects, handles missing title and bounds large responses", async t => {
  let redirectHit = false;
  const server = createServer((req, res) => {
    if (req.url === "/api") { res.setHeader("Content-Type", "application/json"); res.end('{"ok":true}'); }
    else if (req.url === "/redirect") { res.writeHead(302, { Location: "/destination" }); res.end(); }
    else if (req.url === "/destination") { redirectHit = true; res.end(); }
    else { res.setHeader("Content-Type", "text/html"); res.end(req.url === "/large" ? "<html><main>" + "x".repeat(100000) : "<!doctype html><html><title>A &amp; B</title><body>Website</body></html>"); }
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r)); t.after(() => new Promise(r => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await probePage(base)).title, "A & B");
  assert.equal(await probePage(base + "/api"), null); assert.equal(await probePage(base + "/redirect"), null); assert.equal(redirectHit, false);
  assert.equal((await probePage(base + "/large")).title, new URL(base).host);
});

test("concurrent saves persist both entries, deduplicate and survive service downtime/restart", async t => {
  const { root, service } = await fixture(t);
  const one = { url: "http://localhost:3000", title: "First", origin: { kind: "project", projectId: "project1" } };
  const two = { url: "https://example.com", title: "Second", origin: { kind: "external" } };
  await Promise.all([service.action({ operation: "save", site: one }), service.action({ operation: "save", site: two }), service.action({ operation: "save", site: one })]);
  assert.equal((await service.read()).length, 2);
  const restarted = new SitesService({ codexHome: root, dataDir: path.join(root, "saved"), listeners: async () => [] });
  await restarted.discover(); assert.equal((await restarted.read()).length, 2);
  const saved = (await restarted.read()).find(s => s.title === "First");
  await writeFile(path.join(root, ".codex-global-state.json"), '{}');
  assert.equal((await restarted.action({ operation: "resolve", id: saved.id })).missing, "project");
  await assert.rejects(restarted.action({ operation: "save", site: one }), /Project is no longer/);
  await restarted.action({ operation: "remove", id: saved.id }); assert.equal((await restarted.read()).length, 1);
  assert.equal(JSON.parse(await readFile(service.file, "utf8")).schemaVersion, 1);
});

test("corrupted storage is surfaced, never overwritten with an empty library", async t => {
  const { service } = await fixture(t); await mkdir(path.dirname(service.file)); await writeFile(service.file, "broken");
  await assert.rejects(service.action({ operation: "save", site: { url: "https://example.com", origin: { kind: "external" } } }));
  assert.equal(await readFile(service.file, "utf8"), "broken");
});


test("simulator bridge discovery never sends an HTTP request, including node-hosted bridges", async t => {
  const { service, project } = await fixture(t); const probed = [];
  service.listeners = async () => [
    { cwd: project, command: "node /cache/node_modules/.bin/serve-sim simulator-id --fit", url: "http://127.0.0.1:3200/" },
    { cwd: project, command: "node /cache/node_modules/serve-sim/dist/cli.js simulator-id", url: "http://127.0.0.1:3201/" },
    { cwd: project, command: "node /tools/swiftui-preview-browser.mjs Package.swift", url: "http://127.0.0.1:3202/" },
    { cwd: project, command: "", url: "http://127.0.0.1:3203/" },
    { cwd: project, command: "node /project/node_modules/.bin/vite", url: "http://127.0.0.1:5173/" },
  ];
  service.probe = async url => { probed.push(url); return { title: "Web app" }; };
  const result = await service.discover();
  assert.deepEqual(probed, ["http://127.0.0.1:5173/"]);
  assert.equal(result.candidates.length, 1);
});

test("listener metadata reads full process arguments instead of the node executable name", async () => {
  const result = await localListeners({ platform: "darwin", runImpl: async (command, args) => {
    if (command === "ps") return { stdout: "42 node /tools/.bin/serve-sim device --fit\n" };
    if (args.includes("cwd")) return { stdout: "p42\nfcwd\nn/work/project\n" };
    return { stdout: "p42\ncnode\nn*:3200\n" };
  } });
  assert.equal(result[0].command, "node /tools/.bin/serve-sim device --fit");
  assert.equal(result[0].cwd, "/work/project");
});


test("preview jobs reuse captures and disk cache without blocking other actions", async t => {
  const { SitePreviews } = await import("../src/backend/sites-preview.mjs");
  const { root } = await fixture(t); let calls = 0, release;
  const bytes = Buffer.from("preview fixture");
  const previews = new SitePreviews(path.join(root, "previews"), async () => { calls++; await new Promise(resolve => { release = resolve; }); return bytes; });
  assert.deepEqual(previews.request("http://localhost:3000/"), { pending: true });
  const pending = previews.get("http://localhost:3000/");
  while (!release) await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(previews.request("http://localhost:3000/"), { pending: true });
  release(); const result = await pending;
  assert.equal(calls, 1); assert.equal(result.image, "data:image/png;base64," + bytes.toString("base64"));
  const restarted = new SitePreviews(path.join(root, "previews"), () => { throw new Error("must use cache"); });
  assert.deepEqual(await restarted.get("http://localhost:3000/"), result);
});

test("preview requests reject unknown URLs and never capture a simulator bridge", async t => {
  const { service } = await fixture(t); let captures = 0;
  service.previews.request = () => { captures++; return { image: "test" }; };
  await assert.rejects(service.action({ operation: "preview", url: "http://localhost:7777" }), /not in the library/);
  await service.action({ operation: "save", site: { url: "http://localhost:3200", origin: { kind: "external" } } });
  service.listeners = async () => [{ url: "http://127.0.0.1:3200/", command: "node /tools/serve-sim device" }];
  assert.deepEqual(await service.action({ operation: "preview", url: "http://localhost:3200" }), { image: null });
  assert.equal(captures, 0);
});

test("offline static project can be discovered, saved without a URL, started and remembered", async t => {
  const {service,project,root}=await fixture(t);
  await writeFile(path.join(project,"index.html"),"<!doctype html><title>Offline page</title><main>Hello</main>");
  service.listeners=async()=>[];
  let discovery=await service.discover();
  assert.equal(discovery.candidates.length,1);assert.equal(discovery.candidates[0].url,null);
  const saved=await service.action({operation:"save",site:discovery.candidates[0]});
  assert.equal((await service.read())[0].entryId,saved.entryId);
  t.after(()=>service.launcher.stop());
  let result=await service.action({operation:"start",id:saved.id});
  for(let i=0;result.pending&&i<30;i++){await new Promise(r=>setTimeout(r,10));result=await service.action({operation:"start",id:saved.id});}
  assert.match(result.url,/http:\/\/127\.0\.0\.1:/);assert.match(await(await fetch(result.url)).text(),/Hello/);
  discovery=await service.discover();assert.equal(discovery.candidates[0].status,"running");
  service.launcher.stop();
  const restarted=new SitesService({codexHome:root,dataDir:path.join(root,"saved"),listeners:async()=>[]});
  discovery=await restarted.discover();assert.equal(discovery.candidates[0].status,"stopped");assert.ok(discovery.candidates[0].lastStartedAt);
});

test("project metadata finds framework websites but excludes watch tools",async t=>{
  const {service,project}=await fixture(t);service.listeners=async()=>[];
  await mkdir(path.join(project,"web"));await writeFile(path.join(project,"web","package.json"),JSON.stringify({name:"My web",scripts:{dev:"vite"}}));
  await mkdir(path.join(project,"tools"));await writeFile(path.join(project,"tools","package.json"),JSON.stringify({scripts:{dev:"tsc --watch"}}));
  const result=await service.discover();assert.equal(result.candidates.length,1);assert.equal(result.candidates[0].framework,"vite");assert.equal(result.candidates[0].lastStartedAt,undefined);
});
