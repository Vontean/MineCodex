import assert from "node:assert/strict";
import test from "node:test";
import {diagnosticReport} from "../assets/diagnostics.js";

test("export keeps capability evidence and omits user data, paths and raw failures", () => {
  const state={version:"2.0.8",token:"private-token",runtime:{codex:{appPath:"/Users/private/App",version:"26.930.21537"}},
    renderer:{targets:[{targetId:"window",checkedAt:1,bindingToken:"private-binding",account:{userId:"private-account"},
      plugins:[{featureId:"notes",state:"degraded",reason:"design-token-unavailable",content:"private-prompt",tokens:[{name:"--spacing",available:false}]}]}]},
    features:[{id:"notes",state:"degraded",failure:{code:"ERROR",message:"private-error"}}]};
  const report=diagnosticReport(state);
  assert.doesNotMatch(JSON.stringify(report),/private-|\/Users/);
  assert.equal(report.verification,"runtime-observation-only");
  assert.equal(report.codexBuild,"26.930.21537");
  assert.equal(report.targets[0].plugins[0].tokens[0].available,false);
});
