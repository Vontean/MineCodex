import assert from "node:assert/strict";
import test from "node:test";
import { candidateFamily, selectDiscoveryCandidates, isAuxiliarySite } from "../src/domain/discovery-candidates.mjs";
const site = (directory, modifiedAt = 0, projectId = "p") => ({ directory, modifiedAt, projectId, projectName: "Project", title: "Website", entryId: projectId + directory });

test("explicit versions compare numerically; siblings and projects stay independent", () => {
  const candidates = [site("/web/app/v2", 200), site("/web/app/v10", 100), site("/web/other/v2"), site("/web/app/v2", 0, "other")];
  const selected = selectDiscoveryCandidates(candidates, []);
  assert.equal(selected.length, 3);
  assert.ok(selected.includes(candidates[1]));
  assert.ok(!selected.includes(candidates[0]));
  assert.notEqual(candidateFamily(site("/web/cv2")).key, candidateFamily(site("/web/c")).key);
});

test("unversioned copies use entry modification time and saved URLs are omitted", () => {
  const older = site("/web/app", 100), latest = site("/web/app-final", 200);
  assert.deepEqual(selectDiscoveryCandidates([older, latest], []), [latest]);
  assert.deepEqual(selectDiscoveryCandidates([older, latest], [{ ...older, origin: { kind: "project", projectId: "p" } }]), []);
  assert.deepEqual(selectDiscoveryCandidates([{ ...latest, url: "https://example.com/" }], [{ url: "https://example.com/", origin: { kind: "external" } }]), []);
});

test("agent evidence is excluded without removing real demos or documentation sites", () => {
  for (const directory of ["__tests__/web", "docs/research/a", "agent-reports", "playwright-report"]) assert.equal(isAuxiliarySite(directory), true);
  for (const directory of ["demo", "prototype", "docs", "documentation", "contest", "research-portal"]) assert.equal(isAuxiliarySite(directory), false);
});

test("release directory versions and smoke test titles are recognized", () => {
  const old = site("/web/release/Comments-On-Web-1.2.0/popup", 200);
  const latest = site("/web/release/Comments-On-Web-1.10.0/popup", 100);
  assert.deepEqual(selectDiscoveryCandidates([old, latest], []), [latest]);
  assert.equal(isAuxiliarySite("plugins/import-smoke-test/preview"), true);
  assert.equal(isAuxiliarySite("", "Community Import Smoke Test"), true);
});
