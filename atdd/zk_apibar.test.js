// Header row 1, flush right (wireframe wf_zkapi_3, Koh OK 2026-11-25 21:21): model list | refresh | (gap of the
// divider) | key. Same columns as row 2 (import export | send | compare): ui_policy D1. Key panel, "no key yet" on
// Send, error box with the right action per error kind.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { CFG, K, WEB, url, walk, mounted, fs, path } = require("./apibar_kit.js");

test("row 1 holds model list, refresh, a divider-sized gap and the key, in that order; icons with themed tips",
  async function () {
    const { host } = await mounted();
    const kinds = host.children.filter((c) => !c.hidden).map((c) => c.className.split(" ")[0]);
    assert.deepStrictEqual(kinds, ["zk-api-model", "zk-req-btn", "zk-req-divider", "zk-req-btn"]);
    const [, refresh, gap, key] = host.children.filter((c) => !c.hidden);
    assert.deepStrictEqual([refresh.attributes["data-tip"], key.attributes["data-tip"]], [K.ui.apiTips.refresh,
      K.ui.apiTips.key]);
    for (const b of [refresh, key]) {
      assert.strictEqual(b.textContent, "");
      assert.ok(b.innerHTML.includes("<svg"));
    }
    assert.ok(gap.className.includes("zk-api-gap"), "same box as the row 2 divider, not drawn");
  });

test("alignment by construction (ui_policy D1): same button class as row 2; list as wide as two buttons + gap",
  function () {
    const css = fs.readFileSync(path.join(WEB, "components", "apibar", "apibar.css"), "utf8");
    assert.match(css, /\[data-component="apibar"\][^}]*margin-left:\s*auto/);
    assert.match(css, /\[data-component="apibar"\][^}]*gap:\s*var\(--zk-gap-small\)/);
    assert.match(css, /\.zk-api-model\s*\{[^}]*width:\s*calc\(var\(--zk-tool-size\) \* 2 \+ var\(--zk-gap-small\)\)/);
    // One header row since wf_modes round 1: the old row 2 divider is gone, so the gap box is not shown (4 apart).
    assert.match(css, /\.zk-api-gap\s*\{[^}]*display:\s*none/);
    const page = fs.readFileSync(path.join(WEB, "layout", "zk_page.css"), "utf8");
    // One header row since wf_modes round 1 (Koh OK 2026-11-26 17:54): the right groups follow the status line,
    // which takes the free width, so they sit flush right; 16 between groups.
    assert.ok(!page.includes('data-slot="headtop"'));
    assert.match(page, /\[data-slot="header"\][^{]*\{[^}]*flex:\s*0 0 auto;[^}]*gap:\s*var\(--zk-gap-group\)/);
  });

test("model list: shows the chosen name (tip = full name), lists the models, a click chooses; checked time shown",
  async function () {
    const { ctx, EVENTS, calls, byClass, all } = await mounted();
    ctx.bus.emit(EVENTS.models, { hasKey: true, loading: false, checked: "21:08", chosen: "b",
      models: [{ id: "a", name: "Claude Opus 5.5" }, { id: "b", name: "Claude Sonnet 5.5" }] });
    const pick = byClass("zk-api-model");
    assert.strictEqual(pick.attributes["data-tip"], "Claude Sonnet 5.5");
    assert.ok(all().some((n) => n.textContent === "Claude Sonnet 5.5"));
    pick.listeners.click[0]();
    const list = byClass("zk-api-list");
    assert.strictEqual(list.hidden, false);
    const items = list.children.filter((c) => c.attributes.role === "option");
    assert.deepStrictEqual(items.map((i) => i.attributes["aria-selected"]), ["false", "true"]);
    items[0].listeners.click[0]();
    assert.deepStrictEqual(calls.pop(), ["choose", "a"]);
    assert.strictEqual(list.hidden, true);
    assert.ok(list.children.some((c) => c.textContent === ctx.t("aiChecked", { time: "21:08" })));
  });

test("refresh fetches now; while loading the button shows the border run (busy class)", async function () {
  const { host, ctx, EVENTS, calls } = await mounted();
  const refresh = host.children.filter((c) => !c.hidden)[1];
  await refresh.listeners.click[0]();
  assert.deepStrictEqual(calls.pop(), ["refresh", true]);
  ctx.bus.emit(EVENTS.models, { hasKey: true, loading: true, models: [], chosen: "" });
  assert.ok(refresh.classList.contains("zk-busy"));
});

test("key panel: opens from the key, saves / deletes the key, shows only the masked key, closes with X",
  async function () {
    const { host, calls, byClass } = await mounted();
    const key = host.children.filter((c) => !c.hidden)[3];
    const panel = byClass("zk-api-keypanel");
    assert.strictEqual(panel.hidden, true);
    key.listeners.click[0]();
    assert.strictEqual(panel.hidden, false);
    const input = byClass("zk-api-keyinput");
    assert.strictEqual(input.attributes.type, "password");
    input.value = "sk-ant-new";
    byClass("zk-api-save").listeners.click[0]();
    assert.deepStrictEqual(calls.pop(), ["setKey", "sk-ant-new"]);
    assert.strictEqual(input.value, "", "the key is not left in the field");
    byClass("zk-api-delete").listeners.click[0]();
    assert.deepStrictEqual(calls.pop(), ["clearKey"]);
    byClass("zk-api-close").listeners.click[0]();
    assert.strictEqual(panel.hidden, true);
  });

test("Send without a key: the panel opens in 'no key yet' mode; save = key stored AND the send goes on",
  async function () {
    const { ctx, EVENTS, calls, byClass } = await mounted();
    ctx.bus.emit(EVENTS.needKey, { words: "red hair" });
    const panel = byClass("zk-api-keypanel");
    assert.strictEqual(panel.hidden, false);
    assert.ok(panel.classList.contains("zk-api-nokey"));
    byClass("zk-api-keyinput").value = "sk-1";
    await byClass("zk-api-save").listeners.click[0]();
    assert.deepStrictEqual(calls.slice(-2), [["setKey", "sk-1"], ["resume"]]);
  });

test("error box: title + detail per kind; billing kinds open the top-up page; auth opens the key panel; retry kinds retry",
  async function () {
    const { ctx, EVENTS, calls, opened, byClass } = await mounted();
    const box = byClass("zk-api-err");
    assert.strictEqual(box.hidden, true);
    ctx.bus.emit(EVENTS.aiErr, { kind: "credit", retry: false, link: CFG.ai.links.billing, requestId: "req_1" });
    assert.strictEqual(box.hidden, false);
    assert.ok(walk(box, []).some((n) => n.textContent === K.ui.aiErr.credit.title));
    byClass("zk-api-link").listeners.click[0]();
    assert.deepStrictEqual(opened.pop(), [CFG.ai.links.billing, "_blank", "noopener"]);
    ctx.bus.emit(EVENTS.aiErr, { kind: "auth", retry: false });
    byClass("zk-api-errkey").listeners.click[0]();
    assert.strictEqual(byClass("zk-api-keypanel").hidden, false);
    ctx.bus.emit(EVENTS.aiErr, { kind: "busy", retry: true });
    await byClass("zk-api-retry").listeners.click[0]();
    assert.deepStrictEqual(calls.pop(), ["retry"]);
    ctx.bus.emit(EVENTS.aiErr, null);
    assert.strictEqual(box.hidden, true);
  });

test("no key: the model list is dimmed and a click on it opens the key panel", async function () {
  const { ctx, EVENTS, byClass } = await mounted();
  ctx.bus.emit(EVENTS.models, { hasKey: false, loading: false, models: [], chosen: "" });
  const pick = byClass("zk-api-model");
  assert.ok(pick.classList.contains("zk-dim"));
  pick.listeners.click[0]();
  assert.strictEqual(byClass("zk-api-keypanel").hidden, false);
});

test("live look 2026-11-25 21:4x (key panel part replaced by wf_zkapi_5): error X top right; themed focus, no browser default",
  function () {
    const api = fs.readFileSync(path.join(WEB, "components", "apibar", "apibar.css"), "utf8");
    const req = fs.readFileSync(path.join(WEB, "components", "reqbar", "reqbar.css"), "utf8");
    assert.match(api, /\.zk-api-pop > \.zk-api-errclose[^{]*\{[^}]*position:\s*absolute/);
    assert.match(api, /\.zk-api-keyinput:focus \{[^}]*outline:\s*none;[^}]*border-color:\s*var\(--zk-acc\)/);
    assert.match(req, /\.zk-req-words > \.zk-req-wclose[^{]*\{[^}]*position:\s*absolute/);
    assert.match(req, /\.zk-req-winput:focus-visible[^{]*\{[^}]*outline:\s*2px solid var\(--zk-acc\)/);
  });

test("review 2026-11-25: Retry after a model-list error refreshes the list, never re-runs the last Send", async function () {
  const { ctx, EVENTS, calls, byClass } = await mounted();
  ctx.bus.emit(EVENTS.aiErr, { kind: "busy", retry: true, from: "models" });
  await byClass("zk-api-retry").listeners.click[0]();
  assert.deepStrictEqual(calls.pop(), ["refresh", true]);
});

test("review 2026-11-25: closing 'no key yet' without saving forgets the words; Esc in a panel is marked handled; the field is a password field again",
  async function () {
    const { ctx, EVENTS, calls, byClass } = await mounted();
    ctx.bus.emit(EVENTS.needKey, { words: "red" });
    byClass("zk-api-eye").listeners.click[0]();
    assert.strictEqual(byClass("zk-api-keyinput").getAttribute("type"), "text");
    let handled = false;
    byClass("zk-api-keyinput").listeners.keydown[0]({ key: "Escape", preventDefault: () => {
      handled = true;
    } });
    assert.ok(handled);
    assert.deepStrictEqual(calls.pop(), ["forget"]);
    assert.strictEqual(byClass("zk-api-keyinput").getAttribute("type"), "password");
  });
