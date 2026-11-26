// Key panel, wireframe wf_zkapi_5 (Koh OK 2026-11-25 22:14): title row (title | quiet X), field with the eye inside |
// save (accent only when a key is typed), footer (kept here, get a key | red trash only when a key is saved).
// X, save and trash sit in the key's column (ui_policy D1, D5 e); one header row since 2026-11-26: tips open below.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { K, WEB, mounted, fs, path } = require("./apibar_kit.js");

const kids = (n) => (n.children || []).map((c) => c.className);

function css(...p) {
  return fs.readFileSync(path.join(WEB, ...p), "utf8");
}

function rule(text, selector) {
  const at = text.indexOf(selector + " {");
  assert.ok(at >= 0, "rule " + selector);
  return text.slice(at, text.indexOf("}", at));
}

test("structure: head (title | X), row (field with input + eye | save), foot (text | trash)", async function () {
  const { byClass } = await mounted();
  const panel = byClass("zk-api-keypanel");
  assert.deepStrictEqual(kids(panel).slice(0, 3), ["zk-api-head", "zk-api-row", "zk-api-foot"]);
  assert.deepStrictEqual(kids(byClass("zk-api-head")).map((c) => c.split(" ").pop()), ["zk-api-title", "zk-api-close"]);
  assert.deepStrictEqual(kids(byClass("zk-api-field")).map((c) => c.split(" ").pop()), ["zk-api-keyinput", "zk-api-eye"]);
  assert.deepStrictEqual(kids(byClass("zk-api-row")).map((c) => c.split(" ").pop()), ["zk-api-field", "zk-api-save"]);
  assert.deepStrictEqual(kids(byClass("zk-api-foot")).map((c) => c.split(" ").pop()), ["zk-api-foottext", "zk-api-delete"]);
  assert.strictEqual(byClass("zk-api-title").textContent, K.ui.api.keyTitle);
});

test("'no key yet' mode: the title becomes the warn title (with its dot); normal mode gives the title back", async function () {
  const { ctx, EVENTS, byClass, host } = await mounted();
  ctx.bus.emit(EVENTS.needKey, { words: "red" });
  assert.strictEqual(byClass("zk-api-title").textContent, K.ui.api.noKeyTitle);
  assert.ok(byClass("zk-api-head").classList.contains("zk-api-warnhead"));
  byClass("zk-api-close").listeners.click[0]();
  host.children.filter((c) => !c.hidden)[3].listeners.click[0]();
  assert.strictEqual(byClass("zk-api-title").textContent, K.ui.api.keyTitle);
  assert.ok(!byClass("zk-api-head").classList.contains("zk-api-warnhead"));
});

test("save is the one emphasised thing only when a key is typed", async function () {
  const { byClass } = await mounted();
  const input = byClass("zk-api-keyinput");
  const save = byClass("zk-api-save");
  assert.ok(!save.classList.contains("zk-api-ready"));
  input.value = "sk-ant-x";
  input.listeners.input[0]();
  assert.ok(save.classList.contains("zk-api-ready"));
  input.value = "  ";
  input.listeners.input[0]();
  assert.ok(!save.classList.contains("zk-api-ready"));
});

test("trash shows only when a key is saved; after delete it hides", async function () {
  const none = await mounted({ masked: "" });
  none.host.children.filter((c) => !c.hidden)[3].listeners.click[0]();
  assert.strictEqual(none.byClass("zk-api-delete").hidden, true);
  const some = await mounted();
  some.host.children.filter((c) => !c.hidden)[3].listeners.click[0]();
  assert.strictEqual(some.byClass("zk-api-delete").hidden, false);
  some.byClass("zk-api-delete").listeners.click[0]();
  assert.strictEqual(some.byClass("zk-api-delete").hidden, true);
});

test("CSS: the key column (D1): panel reaches the window edge, padding = page side margin, 36 px X / save / field",
  function () {
    const api = css("components", "apibar", "apibar.css");
    const theme = css("theme", "zk_theme.css");
    assert.match(theme, /--zk-page-side:\s*8px/); // 8 since wf_modes round 1: title and left-bar tools share x 8
    assert.match(theme, /--zk-pad:\s*8px var\(--zk-page-side\)/);
    const p = rule(api, ".zk-api-keypanel");
    assert.match(p, /right:\s*calc\(-1 \* var\(--zk-page-side\)\)/);
    assert.match(p, /padding:\s*var\(--zk-page-side\)/);
    assert.match(p, /border-right:\s*none/);
    assert.match(rule(api, ".zk-api-head"), /height:\s*var\(--zk-tool-size\)/);
    assert.match(rule(api, ".zk-api-pop .zk-api-close"), /width:\s*var\(--zk-tool-size\)/);
    assert.match(rule(api, ".zk-api-keyinput"), /height:\s*var\(--zk-tool-size\)/);
    assert.match(rule(api, ".zk-api-field .zk-api-eye"), /position:\s*absolute/);
    assert.match(rule(api, ".zk-api-save.zk-api-ready"), /background:\s*var\(--zk-acc\)/);
    assert.match(rule(api, ".zk-api-foot .zk-api-delete"), /color:\s*var\(--zk-err\)/);
    assert.match(rule(api, ".zk-api-keypanel::before"), /right:\s*calc\(var\(--zk-page-side\) \+ var\(--zk-tool-size\) \/ 2/);
  });

test("CSS: one header row since wf_modes (2026-11-26): the apibar tips open below like every header tip, no left override",
  function () {
    const api = css("components", "apibar", "apibar.css");
    assert.ok(!api.includes('[data-component="apibar"] .zk-req-btn[data-tip]:hover::after'), "no row-1 override left");
    const req = css("components", "reqbar", "reqbar.css");
    assert.match(req, /\.zk-req-btn\[data-tip\]:hover::after[^{]*\{[^}]*top:\s*calc\(100% \+ var\(--zk-gap-small\)\)/);
  });

test("no key: refresh is dimmed with the model list (nothing to refresh yet); with a key both are plain", async function () {
  const { ctx, EVENTS, host } = await mounted();
  const refresh = host.children.filter((c) => !c.hidden)[1];
  ctx.bus.emit(EVENTS.models, { hasKey: false, loading: false, models: [], chosen: "" });
  assert.ok(refresh.classList.contains("zk-dim"));
  ctx.bus.emit(EVENTS.models, { hasKey: true, loading: false, models: [], chosen: "" });
  assert.ok(!refresh.classList.contains("zk-dim"));
  assert.match(css("components", "apibar", "apibar.css"), /\[data-component="apibar"\] \.zk-req-btn\.zk-dim \{[^}]*opacity:\s*0\.45/);
});

test("review 2026-11-25 22:3x: 'get a key' and the error link have the themed focus ring, not the browser default", function () {
  const api = css("components", "apibar", "apibar.css");
  assert.match(api, /\.zk-api-getkey:focus-visible, \.zk-api-link:focus-visible \{[^}]*outline:\s*2px solid var\(--zk-acc\)/);
});
