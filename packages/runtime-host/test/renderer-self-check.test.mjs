import assert from "node:assert/strict";
import test from "node:test";
import {createRendererSelfCheck,tokenRequirements} from "../src/renderer-self-check.mjs";
import {createRuntimeReadyContract} from "../src/codex-injection.mjs";
import {CodexRuntime} from "../src/codex-runtime.mjs";

test("self-check separates installation, anchor disappearance, scope tokens and recovery", () => {
  let anchor=true,token=true;
  const check=createRendererSelfCheck([{id:"a",requiredTokens:["--color-text-primary"]},{id:"b"}],"session",{
    diagnostics:()=>[],
    checkTokens:(_,names)=>names.map(name=>({name,available:token,source:token ? name : null,projectName:"--mcx-color-text-primary",projectValue:token ? "black" : null})),
  });
  check.register("a",()=>({state:anchor ? "available" : "unavailable",checks:[{name:"composer",available:anchor}],scopes:[{name:"composer",element:{isConnected:anchor}}]}));
  check.installed("a");check.failed("b");
  assert.deepEqual(check.snapshot().plugins.map(item=>item.state),["available","failed"]);
  token=false;
  assert.equal(check.snapshot().plugins[0].state,"degraded");
  assert.equal(check.snapshot().plugins[0].tokens[0].scope,"composer");
  anchor=false;
  assert.equal(check.snapshot().plugins[0].state,"unavailable");
  assert.deepEqual(check.snapshot().plugins[0].tokens,[]);
  anchor=true;token=true;
  assert.equal(check.snapshot().plugins[0].state,"available");
  check.register("a",()=>{throw new Error("secret /Users/private/path");});
  assert.equal(check.snapshot().plugins[0].reason,"self-check-failed");
  assert.doesNotMatch(JSON.stringify(check.snapshot()),/secret|\/Users/);
});

test("global injection cannot substitute for per-window evidence", () => {
  const contract=targets=>createRuntimeReadyContract({runtimeSessionId:"session",plugins:[{featureId:"a",state:"configured"}],renderer:{discovered:true,active:true,discoveredTargets:2,injectedTargets:2,targets}});
  const target=(targetId,state,sessionId="session")=>({targetId,sessionId,checkedAt:1,plugins:[{featureId:"a",installation:"installed",state}]});
  assert.equal(contract([]).plugins[0].state,"checking");
  assert.equal(contract([target("a","available")]).plugins[0].state,"partial");
  assert.equal(contract([target("a","available"),target("b","unavailable")]).plugins[0].state,"partial");
  assert.equal(contract([target("a","not-applicable"),target("b","not-applicable")]).plugins[0].state,"not-applicable");
  assert.equal(contract([target("a","available"),target("b","available","old-session")]).plugins[0].state,"partial");
  assert.equal(contract([target("a","available"),target("b","available")]).plugins[0].state,"injected");
});

test("token consumption distinguishes explicit CSS fallback from required values", () => {
  const bindings={"--spacing":"--mcx-spacing","--color-text-primary":"--mcx-color-text-primary"};
  assert.deepEqual(tokenRequirements("var(--mcx-spacing, 4px) var(--mcx-color-text-primary) var(--mcx-spacing)",bindings),[
    {name:"--spacing",required:true},{name:"--color-text-primary",required:true},
  ]);
  const check=createRendererSelfCheck([{id:"a",requiredTokens:tokenRequirements("var(--mcx-spacing, 4px)",bindings)}],"session",{
    diagnostics:()=>[],checkTokens:()=>[{name:"--spacing",available:false}],
  });
  check.installed("a");check.register("a",()=>({state:"available",scopes:[{name:"composer",element:{isConnected:true}}]}));
  assert.equal(check.snapshot().plugins[0].state,"available");
  assert.equal(check.snapshot().plugins[0].tokens[0].available,false);
});

test("a frontend anchor does not hide a backend service that has not started", () => {
  const ready=createRuntimeReadyContract({features:[{id:"notes",healthUrl:"http://localhost/health"}],runtimeSessionId:"session",
    plugins:[{featureId:"notes",state:"configured"}],renderer:{discovered:true,active:true,discoveredTargets:1,injectedTargets:1,
      targets:[{targetId:"window",sessionId:"session",plugins:[{featureId:"notes",state:"available"}]}]}});
  assert.equal(ready.plugins[0].state,"launching");
  assert.equal(ready.plugins[0].targets[0].state,"available");
  assert.equal(ready.plugins[0].serviceState,"configured");
});

test("self-check runs once per document and rechecks after evidence is invalidated", async () => {
  const runtime=new CodexRuntime({features:[],profileDir:"/tmp/mcx-self-check",runtimeSessionId:"session"});
  let reads=0,fail=false,present=true;
  runtime.clients.set("target",{async send(_,params,options){
    reads++;
    assert.equal(options.timeoutMs,3000);
    assert.match(params.expression,/runtime.selfCheck/);
    if (fail) throw new Error("disconnected");
    return {result:{value:present ? {sessionId:"session",checkedAt:1,plugins:[{featureId:"a",state:"available"}]} : null}};
  }});
  assert.equal(await runtime.checkTarget("target"),true);
  await runtime.checkTarget("target");
  assert.equal(reads,1);
  runtime.targetChecks.delete("target");
  fail=true;await runtime.checkTarget("target");
  assert.deepEqual(runtime.targetChecks.get("target").plugins,[]);
  await runtime.checkTarget("target");
  assert.equal(reads,3);
  runtime.targetChecks.delete("target");
  fail=false;await runtime.checkTarget("target");
  assert.equal(runtime.targetChecks.get("target").plugins.length,1);
  runtime.targetChecks.delete("target");present=false;
  assert.equal(await runtime.checkTarget("target"),false);
});

test("target discovery does not repeat probes; document reload invalidates the startup result", async () => {
  const handlers=new Map();let checks=0;
  const client={socket:{readyState:1,close(){}},on(name,handler){handlers.set(name,handler);},async send(method,params){
    if (method === "Page.addScriptToEvaluateOnNewDocument") return {identifier:"script"};
    if (params?.expression?.includes("runtime.selfCheck()")) {
      checks++;return {result:{value:{sessionId:"session",checkedAt:checks,plugins:[]}}};
    }
    return {result:{value:true}};
  }};
  const runtime=new CodexRuntime({features:[],profileDir:"/tmp/mcx-startup-check",runtimeSessionId:"session",
    fetchImpl:async()=>({ok:true,json:async()=>[{id:"target",type:"page",url:"app://-/index.html",webSocketDebuggerUrl:"ws://target"}]}),
    connectClient:async()=>client,logger:{warn(){}}});
  await runtime.refreshTargets();
  await runtime.refreshTargets();
  assert.equal(checks,1);
  handlers.get("Runtime.executionContextsCleared")();
  assert.equal(runtime.targetChecks.has("target"),false);
  await runtime.refreshTargets();
  await runtime.refreshTargets();
  assert.equal(checks,2);
});


test("feature-owned CSS variables do not become missing native tokens", () => {
  const bindings={"--color-text-primary":"--mcx-color-text-primary"};
  const source=".panel { --mcx-purple:var(--app-block-accent-purple, purple); --mcx-local:var(--mcx-color-text-primary); } .bar { color:var(--mcx-purple); background:var(--mcx-local); outline:var(--mcx-unknown); }";
  assert.deepEqual(tokenRequirements(source,bindings),[
    {name:"--color-text-primary",required:true},{name:"--mcx-unknown",required:true,unmapped:true},
  ]);
});


test("startup retries incomplete evidence, then freezes recovered or timed-out results", async () => {
  const runtime=new CodexRuntime({features:[],profileDir:"/tmp/mcx-startup-retry",runtimeSessionId:"session"});
  let state="unknown", reads=0;
  runtime.clients.set("target",{async send(){
    reads++;
    return {result:{value:{sessionId:"session",checkedAt:Date.now(),plugins:[{featureId:"notes",state}]}}};
  }});
  await runtime.checkTarget("target");
  state="available";
  await runtime.checkTarget("target");
  assert.equal(runtime.targetChecks.get("target").plugins[0].state,"available");
  await runtime.checkTarget("target");
  assert.equal(reads,2);
  runtime.targetChecks.delete("target");
  state="unavailable";
  await runtime.checkTarget("target");
  runtime.targetCheckDeadlines.set("target",0);
  await runtime.checkTarget("target");
  assert.equal(reads,3);
  assert.equal(runtime.targetChecks.get("target").plugins[0].state,"unavailable");
});
