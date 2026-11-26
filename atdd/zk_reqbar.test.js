// Header group for the request to Claude (wf_zkreq_3; Koh 16:0x voice, 16:20 "ไม่ต้องใส่ text", 16:21 "ชิดขวาเลย";
// wf_zkapi_3, Koh OK 2026-11-25 21:21): Import SVG, Export SVG, Send | Compare, icons only, flush right; Send opens
// the word box (X closes); the plane's border shows the progress; red dot = answers not seen.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { install } = require("./fake_dom.js");

const WEB = path.join(__dirname, "..", "web");
const CFG = JSON.parse(fs.readFileSync(path.join(WEB, "config", "zkroto.json"), "utf8"));
const K = JSON.parse(fs.readFileSync(path.join(WEB, "constants", "zkroto.json"), "utf8"));

function url(...p) {
  return pathToFileURL(path.join(WEB, ...p)).href;
}

async function mounted() {
  install();
  const timers = [];
  globalThis.setInterval = (fn, ms) => timers.push(["interval", fn, ms]);
  globalThis.setTimeout = (fn, ms) => timers.push(["timeout", fn, ms]);
  globalThis.clearTimeout = () => null;
  const { createBus, EVENTS } = await import(url("js", "zk_events.js"));
  const { mount } = await import(url("components", "reqbar", "reqbar.js"));
  const host = document.createElement("div");
  const calls = [];
  const request = { send: async () => calls.push("send"), exportSvg: () => calls.push("svg"),
    list: async () => calls.push("list"), importSvg: async (text) => calls.push(["import", text]) };
  const ai = { send: async (w) => calls.push(["ai", w]), stop: async () => calls.push("stop"), busy: () => false };
  const docKeys = [];
  document.addEventListener = (name, fn) => docKeys.push([name, fn]);
  globalThis.__docKeys = docKeys;
  const statusLog = [];
  const ctx = { cfg: CFG, k: K, bus: createBus(), t: (key, v) => K.text[key].replace("{id}", (v || {}).id)
    .replace("{message}", (v || {}).message), status: (m, c) => statusLog.push([m, c]), statusLog };
  const opened = [];
  ctx.bus.on(EVENTS.compare, (d) => opened.push(d));
  mount(host, ctx, { request, ai });
  const buttons = host.children.filter((c) => c.tag === "button");
  return { host, buttons, calls, ctx, EVENTS, opened, timers };
}

test("four icon buttons, tips from constants, no words; the group sits flush right (CSS margin-left auto)",
  async function () {
    const { buttons } = await mounted();
    assert.deepStrictEqual(buttons.map((b) => b.attributes["data-tip"]), [K.ui.reqTips.import, K.ui.reqTips.svg,
      K.ui.reqTips.send, K.ui.reqTips.compare]);
    for (const b of buttons) {
      assert.strictEqual(b.textContent, "");
      assert.ok(b.innerHTML.includes("<svg"), "an icon");
      assert.strictEqual(b.attributes["aria-label"], b.attributes["data-tip"]);
    }
    const css = fs.readFileSync(path.join(WEB, "components", "reqbar", "reqbar.css"), "utf8");
    assert.match(css, /\[data-component="reqbar"\][^}]*margin-left:\s*auto/);
  });

test("buttons call the request part; Compare opens the panel; it is off until an answer exists", async function () {
  const { buttons, calls, ctx, EVENTS, opened, timers } = await mounted();
  assert.deepStrictEqual(calls, ["list"], "asks for answers once at start");
  assert.strictEqual(timers[0][2], CFG.request.pollMs, "then every pollMs");
  buttons[1].listeners.click[0]();
  assert.deepStrictEqual(calls.slice(1), ["svg"]);
  assert.strictEqual(buttons[3].disabled, true);
  ctx.bus.emit(EVENTS.request, { answers: 2, unseen: 1 });
  assert.strictEqual(buttons[3].disabled, false);
  buttons[3].listeners.click[0]();
  assert.deepStrictEqual(opened, [{ open: true }]);
});

test("red dot shows the unseen count and hides at 0; a toast after Send goes away after toastMs", async function () {
  const { host, ctx, EVENTS, timers } = await mounted();
  const dot = host.children.find((c) => c.className === "zk-req-dot") ||
    host.children.flatMap((c) => c.children).find((c) => c.className === "zk-req-dot");
  assert.strictEqual(dot.hidden, true);
  ctx.bus.emit(EVENTS.request, { answers: 3, unseen: 2 });
  assert.deepStrictEqual([dot.hidden, dot.textContent], [false, "2"]);
  ctx.bus.emit(EVENTS.request, { answers: 3, unseen: 0 });
  assert.strictEqual(dot.hidden, true);
  const toast = host.children.find((c) => c.className === "zk-req-toast");
  assert.strictEqual(toast.hidden, true);
  ctx.bus.emit(EVENTS.request, { sent: "req_20261124_184001" });
  assert.strictEqual(toast.hidden, false);
  assert.ok(toast.textContent.includes("req_20261124_184001"));
  const hide = timers.find((t) => t[0] === "timeout" && t[2] === CFG.request.toastMs);
  hide[1]();
  assert.strictEqual(toast.hidden, true);
});

test("live check 2026-11-24 23:1x, one row since 2026-11-26 (wf_modes): the status takes the free width, so the groups sit flush right",
  function () {
    const css = fs.readFileSync(path.join(WEB, "layout", "zk_page.css"), "utf8");
    assert.match(css, /\.zk-status\s*\{[^}]*flex:\s*1 1 auto/);
    assert.match(css, /\[data-slot="header"\][^{]*\{[^}]*flex:\s*0 0 auto/);
  });

function walk(node, out) {
  out.push(node);
  (node.children || []).forEach((c) => walk(c, out));
  return out;
}

test("import: the icon clicks a hidden file input; the chosen .svg text goes to the request part", async function () {
  const { host, buttons, calls } = await mounted();
  const input = walk(host, []).find((n) => n.tag === "input" && n.attributes.type === "file");
  assert.strictEqual(input.attributes.accept, ".svg,image/svg+xml");
  assert.strictEqual(input.hidden, true, "no browser file picker look (z-ui Never)");
  let clicked = 0;
  input.click = () => {
    clicked += 1;
  };
  buttons[0].listeners.click[0]();
  assert.strictEqual(clicked, 1);
  input.files = [{ name: "hair.svg", text: async () => "<svg/>" }];
  await input.listeners.change[0]();
  assert.deepStrictEqual(calls.pop(), ["import", "<svg/>"]);
  assert.strictEqual(input.value, "", "the same file can be picked again");
});

test("send: opens the word box under the plane (X closes); Enter sends the words and closes; empty = nothing",
  async function () {
    const { host, buttons, calls } = await mounted();
    const box = walk(host, []).find((n) => (n.className || "").includes("zk-req-words"));
    assert.strictEqual(box.hidden, true);
    await buttons[2].listeners.click[0]();
    assert.strictEqual(box.hidden, false);
    const input = walk(box, []).find((n) => n.tag === "input");
    const close = walk(box, []).find((n) => (n.className || "").includes("zk-req-wclose"));
    assert.strictEqual(close.attributes["data-tip"], K.ui.reqTips.close);
    close.listeners.click[0]();
    assert.strictEqual(box.hidden, true);
    await buttons[2].listeners.click[0]();
    input.value = "  ";
    await input.listeners.keydown[0]({ key: "Enter", preventDefault: () => null, stopPropagation: () => null });
    assert.ok(!calls.some((c) => c[0] === "ai"));
    input.value = "red hair";
    await input.listeners.keydown[0]({ key: "Enter", preventDefault: () => null, stopPropagation: () => null });
    assert.deepStrictEqual(calls.pop(), ["ai", "red hair"]);
    assert.strictEqual(box.hidden, true);
    await buttons[2].listeners.click[0]();
    input.listeners.keydown[0]({ key: "Escape", preventDefault: () => null, stopPropagation: () => null });
    assert.strictEqual(box.hidden, true);
  });

test("progress runs on the plane's own border (Koh 21:0x: not a circle): stage class + --zk-progress value",
  async function () {
    const { buttons, ctx, EVENTS } = await mounted();
    const plane = buttons[2];
    const ring = plane.children.find((c) => (c.className || "").includes("zk-req-ring"));
    assert.ok(ring, "a border shape inside the button");
    ctx.bus.emit(EVENTS.ai, { stage: "claude" });
    assert.strictEqual(plane.attributes["data-stage"], "claude");
    ctx.bus.emit(EVENTS.ai, { stage: "comfy", progress: 0.6 });
    assert.strictEqual(plane.style["--zk-progress"], "60");
    ctx.bus.emit(EVENTS.ai, { stage: "idle" });
    assert.strictEqual(plane.attributes["data-stage"], "idle");
    const css = fs.readFileSync(path.join(WEB, "components", "reqbar", "reqbar.css"), "utf8");
    assert.match(css, /\.zk-req-ring[^}]*rx|border-radius/);
  });

test("review 2026-11-25: Esc stops a running Send only when no panel handled it; a file that cannot be read -> status",
  async function () {
    const { host, buttons, calls, ctx, EVENTS } = await mounted();
    const keydown = globalThis.__docKeys.find((d) => d[0] === "keydown")[1];
    ctx.bus.emit(EVENTS.ai, { stage: "claude" });
    keydown({ key: "Escape", defaultPrevented: true });
    assert.ok(!calls.includes("stop"));
    keydown({ key: "Escape", defaultPrevented: false });
    assert.ok(calls.includes("stop"));
    const input = walk(host, []).find((n) => n.tag === "input" && n.attributes.type === "file");
    input.files = [{ name: "x.svg", text: async () => {
      throw new Error("unreadable");
    } }];
    await input.listeners.change[0]();
    assert.ok(ctx.statusLog.some((s) => /unreadable/.test(s[0])));
    assert.ok(buttons.length === 4);
  });
