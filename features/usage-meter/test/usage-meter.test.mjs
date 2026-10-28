import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/usage-meter.mjs", import.meta.url), "utf8");
import { createUsageAdapter } from "../src/adapters/codex/renderer.mjs";
import { createCodexEnvironment } from "../../../packages/codex-adapter/src/renderer/environment.mjs";
const avatar={getAttribute:()=>"Open account menu"};
const readContext=context=>createUsageAdapter(new AbortController().signal,{rail:()=>({querySelectorAll:()=>[avatar]}),props:(_node,predicate)=>predicate(context),report(){}},()=>{}).read();
const auth={authMethod:"chatgpt",userId:"user-a",accountId:"account-a"};
const quotaClient=getQueryData=>({getQueryData,getQueryCache:()=>({subscribe:()=>()=>{}})});
const remainingWindows=data=>readContext({auth,client:quotaClient(()=>data),router:{navigate(){}}}).windows;
const currentWindows=context=>readContext({...context,client:context.client && {...quotaClient(()=>null),...context.client}}).windows;
const findAvatar=rail=>createUsageAdapter(new AbortController().signal,{rail:()=>rail,props:()=>null,report(){}},()=>{}).read().avatar;
const bucket = (used_percent, limit_window_seconds) => ({ used_percent, limit_window_seconds });
const data = (primary, secondary = null) => ({ user_id: "user-a", account_id: "account-a", rate_limit: { primary_window: primary, secondary_window: secondary } });

test("weekly-only plans show remaining percent, including 0 and 100", () => {
  assert.deepEqual(remainingWindows(data(bucket(25, 604800))), { weekly: 75, fiveHour: null, primary: 75, resetAt: { weekly: null, fiveHour: null } });
  assert.equal(remainingWindows(data(bucket(100, 604800))).primary, 0);
  assert.equal(remainingWindows(data(bucket(0, 604800))).primary, 100);
});

test("five-hour value takes precedence regardless of primary/secondary order", () => {
  const expected = { weekly: 75, fiveHour: 40, primary: 40, resetAt: { weekly: null, fiveHour: null } };
  assert.deepEqual(remainingWindows(data(bucket(60, 18000), bucket(25, 604800))), expected);
  assert.deepEqual(remainingWindows(data(bucket(25, 604800), bucket(60, 18000))), expected);
  assert.deepEqual(remainingWindows({ ...data(bucket(25, 604800), bucket(100, 18000)), plan_type: "unrecognized-plan" }), { weekly: 75, fiveHour: 0, primary: 0, resetAt: { weekly: null, fiveHour: null } });
});

test("invalid or missing windows do not become fabricated 100 percent", () => {
  for (const used of [null, undefined, "25", NaN, Infinity]) assert.equal(remainingWindows(data(bucket(used, 604800))), null);
  assert.equal(remainingWindows(null), null);
  assert.equal(remainingWindows(data(bucket(25, 300))), null);
  assert.equal(remainingWindows(data(bucket(25, 18000))), null);
  assert.deepEqual(remainingWindows(data(bucket(25, 604800), bucket(null, 18000))), { weekly: 75, fiveHour: null, primary: 75, resetAt: { weekly: null, fiveHour: null } });
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

test("native context discovers capabilities and exposes only normalized quota",()=>{
  const stored=data(bucket(25,604800)), rail={querySelectorAll:()=>[avatar],__reactFiber$fixture:{memoizedProps:{auth},return:{memoizedProps:{client:quotaClient(()=>stored)},return:{memoizedProps:{router:{navigate(){}}}}}}};
  const codex={...createCodexEnvironment(),rail:()=>rail};
  const result=createUsageAdapter(new AbortController().signal,codex,()=>{}).read();
  assert.equal(result.windows.primary,75); assert.equal(result.available,true);
  assert.equal("client" in result,false); assert.equal("auth" in result,false);
});

test("Avatar anchor remains discoverable when Help moves out of the navigation rail", () => {
  const button = (label, hasImage = false) => ({
    getAttribute: name => name === "aria-label" ? label : null,
    matches: () => false,
    querySelector: () => hasImage ? {} : null,
  });
  const projects = button("Projects"), avatar = button("Open account menu");
  assert.equal(findAvatar({ querySelectorAll: () => [projects, avatar] }), avatar);
  assert.equal(findAvatar({ querySelectorAll: () => [projects, button("", true)] })?.querySelector() != null, true);
  assert.equal(findAvatar({ querySelectorAll: () => [projects] }), null);
});

test("usage button mounts immediately above the Avatar without inheriting account navigation", () => {
  class Node {
    constructor(classes = []) { this.attributes = []; this.children = []; this.classList = { contains: value => classes.includes(value) }; }
    cloneNode() { const clone = new Node(); clone.attributes = this.attributes.map(attribute => ({ ...attribute })); return clone; }
    setAttribute(name, value) { this.attributes.push({ name, value }); }
    removeAttribute(name) { this.attributes = this.attributes.filter(attribute => attribute.name !== name); }
    addEventListener() {}
    append(child) { this.children.push(child); }
    before(child) { this.parentElement.children.splice(this.parentElement.children.indexOf(this), 0, child); child.parentElement = this.parentElement; }
  }
  const rail = new Node(), footer = new Node(["flex-col"]), row = new Node(), inner = new Node(), avatar = new Node();
  avatar.setAttribute("data-sidebar-destination", "builtin:account");
  avatar.setAttribute("title", "Account");
  rail.append(footer); footer.parentElement = rail;
  footer.append(row); row.parentElement = footer;
  row.append(inner); inner.parentElement = row;
  inner.append(avatar); avatar.parentElement = inner;
  const document = { createElement: () => new Node(), body: new Node() };
  const mount = new Function("document", "MARKER", "TIP_ID", "config", "nativeUsage", `let record, hoverTimer; const hideTooltip = () => {}, showTooltip = () => {}; ${source.slice(source.indexOf("function mount("), source.indexOf("function sync()"))}\nreturn (avatar, rail, usage) => { mount(avatar, rail, usage); return record; };`)(document, "data-minecodex-usage-meter", "minecodex-usage-tooltip", {ui:{tooltipSurface:node=>node,theme:{bindScope(){}}}},createUsageAdapter(new AbortController().signal,{},()=>{}));
  const record = mount(avatar, rail);
  assert.deepEqual(footer.children, [record.button, row]);
  assert.deepEqual(inner.children, [avatar]);
  assert.equal(record.button.attributes.some(attribute => attribute.name === "data-sidebar-destination" || attribute.name === "title"), false);
  const usage = new Node();
  usage.setAttribute("aria-haspopup", "menu");
  usage.setAttribute("aria-label", "Usage");
  footer.children.unshift(usage); usage.parentElement = footer;
  const replacement = mount(avatar, rail, usage);
  assert.equal(footer.children[0], replacement.button);
  assert.equal(footer.children[1], usage);
  assert.ok(usage.attributes.some(attribute => attribute.name === "data-minecodex-native-usage"));
  assert.equal(replacement.button.attributes.some(attribute => attribute.name === "aria-haspopup"), false);
  createUsageAdapter(new AbortController().signal, {}, () => {}).reveal(usage);
  assert.equal(usage.attributes.some(attribute => attribute.name === "data-minecodex-native-usage"), false);
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

test("two-segment render keeps the five-hour number and quota tooltip", () => {
  const { button, tooltip } = render({ weekly: 75, fiveHour: 40, primary: 40, resetAt: { weekly: null, fiveHour: null } });
  const [svg, number] = button.children;
  assert.equal(number.textContent, "40");
  assert.deepEqual(svg.children.map(group => group.attributes["data-window"]), ["fiveHour", "weekly"]);
  assert.deepEqual(tooltip.children[0].children.flatMap(group => group.children.map(node => node.textContent)), ["5h Limit", "40%", "Weekly Limit", "75%"]);
});

const arcValues = path => path.attributes.d.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
const angle = (x, y) => (Math.atan2(x - 16, 16 - y) * 180 / Math.PI + 360) % 360;

test("full quota has two round-ended segments on one radius with visible gaps", () => {
  const groups = render({ weekly: 100, fiveHour: 100, primary: 100 }).button.children[0].children;
  const [long, short] = groups.map(group => arcValues(group.children[0]));
  assert.equal(long[2], short[2]);
  assert.equal(long[5], 1); // 上方长段超过半圈。
  assert.equal(short[5], 0);
  assert.equal(long[6], 1);
  assert.equal(short[6], 0);
  assert.ok(long[1] > 16 && long[8] > 16 && short[1] > 16 && short[8] > 16);
  const leftGap = Math.hypot(long[0] - short[0], long[1] - short[1]);
  const rightGap = Math.hypot(long[7] - short[7], long[8] - short[8]);
  for (const group of groups) {
    assert.equal(group.attributes["stroke-linecap"], "round");
    assert.equal(group.children[1].attributes.d, group.children[0].attributes.d);
    // 扣除圆头直径后，实际 24px 图上两处净空均至少 1.9px。
    for (const gap of [leftGap, rightGap]) assert.ok(gap * 24 / 32 - Number(group.attributes["stroke-width"]) >= 1.9);
  }
});

test("both quotas deplete from the left cut, keeping their right endpoints fixed", () => {
  const full = render({ weekly: 100, fiveHour: 100, primary: 100 }).button.children[0].children;
  for (const remaining of [77, 50, 1]) {
    const groups = render({ weekly: remaining, fiveHour: remaining, primary: remaining }).button.children[0].children;
    groups.forEach((group, index) => {
      const track = arcValues(full[index].children[0]), progress = arcValues(group.children[1]);
      assert.deepEqual(progress.slice(7), track.slice(7));
      const from = angle(track[0], track[1]), current = angle(progress[0], progress[1]);
      const consumed = index === 0 ? (current - from + 360) % 360 : (from - current + 360) % 360;
      const sector = index === 0 ? 270 : 90;
      assert.ok(Math.abs(consumed / (sector - 24) - (1 - remaining / 100)) < 1e-10);
    });
  }
  for (const windows of [{ weekly: 100, fiveHour: 0, primary: 0 }, { weekly: 0, fiveHour: 100, primary: 100 }, { weekly: 0, fiveHour: 0, primary: 0 }]) {
    const groups = render(windows).button.children[0].children;
    assert.equal(groups[0].children.length, windows.fiveHour === 0 ? 1 : 2);
    assert.equal(groups[1].children.length, windows.weekly === 0 ? 1 : 2);
  }
});

test("single-ring render and exhausted limits have no extra row or progress dot", () => {
  const { button, tooltip } = render({ weekly: 0, fiveHour: null, primary: 0, resetAt: { weekly: null, fiveHour: null } });
  assert.equal(button.children[0].children.length, 1);
  assert.equal(button.children[0].children[0].children.length, 1);
  assert.equal(button.children[1].textContent, "0");
  assert.deepEqual(tooltip.children[0].children.flatMap(group => group.children.map(node => node.textContent)), ["Weekly Limit", "0%"]);
  const full = render({ weekly: 100, fiveHour: null, primary: 100 }).button.children[0].children[0];
  assert.equal(full.children[0].tag, "circle");
  assert.equal(full.children[1].attributes["stroke-dasharray"], "100 100");
  assert.equal(full.children[1].attributes.transform, "rotate(-90 16 16)");
});


test("reset timestamps follow window duration and prefer absolute Unix seconds", t => {
  const weekly = { ...bucket(25, 604800), reset_at: 1791909000, reset_after_seconds: 300 };
  const fiveHour = { ...bucket(60, 18000), reset_after_seconds: 10800 };
  const client = { ...quotaClient(() => data(weekly, fiveHour)), getQueryState: () => ({ dataUpdatedAt: 1791810000000 }) };
  const read = () => currentWindows({ auth, client });
  assert.deepEqual(read().resetAt, { weekly: 1791909000000, fiveHour: 1791820800000 });
  t.mock.method(Date, "now", () => 1791817200000);
  assert.deepEqual(read().resetAt, { weekly: 1791909000000, fiveHour: 1791820800000 });
  for (const reset_at of [null, "1791909000", NaN, Infinity, -1]) {
    assert.equal(remainingWindows(data({ ...bucket(25, 604800), reset_at })).resetAt.weekly, null);
  }
  assert.equal(remainingWindows(data({ ...bucket(25, 604800), reset_after_seconds: 300 })).resetAt.weekly, null);
  for (const reset_after_seconds of [-1, "300", NaN, Infinity]) {
    const client = { ...quotaClient(() => data({ ...bucket(25, 604800), reset_after_seconds })), getQueryState: () => ({ dataUpdatedAt: 1791810000000 }) };
    assert.equal(currentWindows({ auth, client }).resetAt.weekly, null);
  }
});

test("tooltip shows local reset dates to the minute within each quota group", () => {
  const fiveHour = new Date(2026, 9, 14, 1, 5, 59).getTime();
  const weekly = new Date(2026, 9, 20, 18, 30).getTime();
  const { tooltip } = render({ weekly: 75, fiveHour: 40, primary: 40, resetAt: { fiveHour, weekly } });
  assert.deepEqual(tooltip.children[0].children.map(group => group.children.map(node => node.textContent)), [
    ["5h Limit", "40%", "Reset in", "10/14 01:05"],
    ["Weekly Limit", "75%", "Reset in", "10/20 18:30"],
  ]);
  const single = render({ weekly: 75, fiveHour: null, primary: 75, resetAt: { weekly } }).tooltip;
  assert.equal(single.children[0].children.length, 1);
  assert.deepEqual(single.children[0].children[0].children.map(node => node.textContent), ["Weekly Limit", "75%", "Reset in", "10/20 18:30"]);
});


test("native Usage discovery excludes our replacement and follows the track token across locales", () => {
  const native = { getAttribute: () => "使用量", querySelector: selector => selector.includes("color-usage-meter-track") ? {} : null };
  const own = { hasAttribute: () => true, getAttribute: () => "Usage", querySelector: () => ({}) };
  const result = createUsageAdapter(new AbortController().signal, {
    rail: () => ({querySelectorAll: () => [own, native, avatar]}), props: () => null, report() {},
  }, () => {}).read();
  assert.equal(result.usage, native);
});
