import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/usage-meter.mjs", import.meta.url), "utf8");
const { remainingWindows, currentWindows, nativeContext } = new Function(`${source.slice(0, source.indexOf("const style ="))}\nreturn { remainingWindows, currentWindows, nativeContext };`)();
const bucket = (used_percent, limit_window_seconds) => ({ used_percent, limit_window_seconds });
const data = (primary, secondary = null) => ({ user_id: "user-a", account_id: "account-a", rate_limit: { primary_window: primary, secondary_window: secondary } });

test("weekly-only plans show remaining percent, including 0 and 100", () => {
  assert.deepEqual(remainingWindows(data(bucket(25, 604800))), { weekly: 75, fiveHour: null, primary: 75 });
  assert.equal(remainingWindows(data(bucket(100, 604800))).primary, 0);
  assert.equal(remainingWindows(data(bucket(0, 604800))).primary, 100);
});

test("five-hour value takes precedence regardless of primary/secondary order", () => {
  const expected = { weekly: 75, fiveHour: 40, primary: 40 };
  assert.deepEqual(remainingWindows(data(bucket(60, 18000), bucket(25, 604800))), expected);
  assert.deepEqual(remainingWindows(data(bucket(25, 604800), bucket(60, 18000))), expected);
  assert.deepEqual(remainingWindows({ ...data(bucket(25, 604800), bucket(100, 18000)), plan_type: "unrecognized-plan" }), { weekly: 75, fiveHour: 0, primary: 0 });
});

test("invalid or missing windows do not become fabricated 100 percent", () => {
  for (const used of [null, undefined, "25", NaN, Infinity]) assert.equal(remainingWindows(data(bucket(used, 604800))), null);
  assert.equal(remainingWindows(null), null);
  assert.equal(remainingWindows(data(bucket(25, 300))), null);
  assert.equal(remainingWindows(data(bucket(25, 18000))), null);
  assert.deepEqual(remainingWindows(data(bucket(25, 604800), bucket(null, 18000))), { weekly: 75, fiveHour: null, primary: 75 });
});

test("clamps and rounds remaining percentage", () => {
  assert.equal(remainingWindows(data(bucket(-3, 604800))).primary, 100);
  assert.equal(remainingWindows(data(bucket(103, 604800))).primary, 0);
  assert.equal(remainingWindows(data(bucket(25.4, 604800))).primary, 75);
});

test("cache reads require exact current account and user, including after account switching", () => {
  const auth = { authMethod: "chatgpt", userId: "user-a", accountId: "account-a" };
  const stored = data(bucket(25, 604800));
  const reads = [];
  const cache = new Map([[JSON.stringify(["rate-limit-status"]), stored]]);
  const client = { getQueryData: key => { reads.push(key); return cache.get(JSON.stringify(key)); } };
  assert.equal(currentWindows({ auth, client }).primary, 75);
  assert.deepEqual(reads[0], ["rate-limit-status"]);
  assert.equal(currentWindows({ auth: { ...auth, accountId: "account-b" }, client }), null);
  assert.equal(currentWindows({ auth: { ...auth, userId: "user-b" }, client }), null);
  assert.equal(currentWindows({ auth: { ...auth, isLoading: true }, client }), null);
  assert.equal(currentWindows({ auth: { ...auth, authMethod: "apikey" }, client }), null);
  assert.equal(currentWindows({ auth: null, client }), null);
  assert.equal(currentWindows({ auth, client: { getQueryData: () => undefined } }), null);
});

test("native context uses provider capabilities rather than minified component names", () => {
  const auth = { authMethod: "chatgpt", userId: "user-a", accountId: "account-a" };
  const client = { getQueryCache() {}, getQueryData() {} }, router = { navigate() {} };
  const rail = { __reactFiber$fixture: { memoizedProps: { value: "unrelated" }, return: {
    memoizedProps: { auth }, return: { memoizedProps: { value: { router } }, return: { memoizedProps: { client } } },
  } } };
  assert.deepEqual(nativeContext(rail), { auth, client, router });
  assert.deepEqual(nativeContext({}), { auth: null, client: null, router: null });
});

// 用轻量 DOM 验证真实渲染函数的行顺序和环数据，不改动原生账号缓存。
class Element {
  constructor(tag) { this.tag = tag; this.attributes = {}; this.children = []; this.hidden = true; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
}
const documentFixture = {
  head: new Element("head"),
  createElement: tag => new Element(tag),
  createElementNS: (_, tag) => new Element(tag),
};
const render = new Function("document", `${source.slice(0, source.indexOf("function positionTooltip()"))}\nreturn windows => { record = {button: document.createElement('button'), tooltip: document.createElement('div')}; draw(windows); return record; };`)(documentFixture);

test("dual-ring render uses weekly outside, five-hour inside, and five-hour number", () => {
  const { button, tooltip } = render({ weekly: 75, fiveHour: 40, primary: 40 });
  const [svg, number] = button.children;
  assert.equal(number.textContent, "40");
  assert.deepEqual(svg.children.map(group => group.attributes["data-window"]), ["weekly", "fiveHour"]);
  assert.deepEqual(svg.children.map(group => group.children[1].attributes["stroke-dasharray"]), ["75 100", "40 100"]);
  assert.ok(Number(svg.children[0].children[0].attributes.r) > Number(svg.children[1].children[0].attributes.r));
  assert.deepEqual(tooltip.children[0].children.map(node => node.textContent), ["5h Limit", "40%", "Weekly Limit", "75%"]);
});

test("single-ring render and exhausted limits have no extra row or progress dot", () => {
  const { button, tooltip } = render({ weekly: 0, fiveHour: null, primary: 0 });
  assert.equal(button.children[0].children.length, 1);
  assert.equal(button.children[0].children[0].children.length, 1);
  assert.equal(button.children[1].textContent, "0");
  assert.deepEqual(tooltip.children[0].children.map(node => node.textContent), ["Weekly Limit", "0%"]);
});
