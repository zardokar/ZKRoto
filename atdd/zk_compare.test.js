// Compare panel (wf_zkreq_3; Koh voice 2026-11-24 16:0x): opens over the stage; status = request id, the words
// Koh gave, seed, n / total; two modes on one icon switch: side by side and wipe; back / next walk the answers;
// Esc / X close; arrow keys move the wipe; zoom and pan move both pictures together.
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
const ANSWERS = [
  { key: "req_2:1", id: "req_2", n: 1, prompt: "red hair", seed: 23, src: "/view?s2", result: "/view?r21" },
  { key: "req_1:1", id: "req_1", n: 1, prompt: "blue hair", seed: 7, src: "/view?s1", result: "/view?r11" }];

function url(...p) {
  return pathToFileURL(path.join(WEB, ...p)).href;
}

function walk(node, out) {
  out.push(node);
  (node.children || []).forEach((c) => walk(c, out));
  return out;
}

async function mounted() {
  install();
  const keys = [];
  globalThis.addEventListener = (name, fn) => name === "keydown" && keys.push(fn);
  globalThis.__lastKeys = keys;
  const { createBus, EVENTS } = await import(url("js", "zk_events.js"));
  const { mount } = await import(url("components", "compare", "compare.js"));
  const host = document.createElement("div");
  const seen = [];
  const request = { answers: () => ANSWERS, markSeen: (k) => seen.push(k) };
  const ctx = { cfg: CFG, k: K, bus: createBus(), t: (key, v) => K.text[key].replace(/\{(\w+)\}/g, (_m, n) => v[n]) };
  const c = mount(host, ctx, { request });
  const all = walk(host, []);
  const find = (cls) => all.filter((n) => (n.className || "").split(" ").includes(cls));
  const stops = [];
  const press = (code) => {
    const e = { code, key: code, preventDefault: () => null, stopPropagation: () => stops.push(code) };
    keys.forEach((fn) => fn(e));
  };
  return { host, ctx, EVENTS, seen, find, press, c, stops, request };
}

test("hidden until opened; opens on the newest answer with its status and both pictures", async function () {
  const { host, ctx, EVENTS, seen, find } = await mounted();
  assert.strictEqual(host.hidden, true);
  ctx.bus.emit(EVENTS.compare, { open: true });
  assert.strictEqual(host.hidden, false);
  assert.strictEqual(find("zk-cmp-status")[0].textContent, 'req_2 · "red hair" · seed 23 · 1 / 2');
  assert.deepStrictEqual([find("zk-cmp-before")[0].children[0].src, find("zk-cmp-after")[0].children[0].src],
    ["/view?s2", "/view?r21"]);
  assert.deepStrictEqual(seen, ["req_2:1"]);
});

test("next / back walk the answers; icon switch picks side by side or wipe (one pressed)", async function () {
  const { host, ctx, EVENTS, find } = await mounted();
  ctx.bus.emit(EVENTS.compare, { open: true });
  const [side, wipe, back, next] = find("zk-cmp-btn");
  next.listeners.click[0]();
  assert.match(find("zk-cmp-status")[0].textContent, /req_1 .* 2 \/ 2/);
  next.listeners.click[0]();
  assert.match(find("zk-cmp-status")[0].textContent, /2 \/ 2/, "no wrap at the end");
  back.listeners.click[0]();
  assert.match(find("zk-cmp-status")[0].textContent, /1 \/ 2/);
  assert.strictEqual(host.dataset.mode, "side");
  wipe.listeners.click[0]();
  assert.deepStrictEqual([host.dataset.mode, side.attributes["aria-pressed"], wipe.attributes["aria-pressed"]],
    ["wipe", "false", "true"]);
  for (const b of find("zk-cmp-btn")) {
    assert.strictEqual(b.textContent, "", "icons only");
    assert.ok(b.attributes["data-tip"]);
  }
});

test("arrow keys move the wipe (wipe mode only); Esc closes; keys do nothing while closed", async function () {
  const { host, ctx, EVENTS, find, press } = await mounted();
  press("Escape");
  assert.strictEqual(host.hidden, true);
  ctx.bus.emit(EVENTS.compare, { open: true });
  const handle = find("zk-cmp-handle")[0];
  press("ArrowRight");
  assert.strictEqual(handle.style.left, "50%", "side mode: the wipe stays");
  find("zk-cmp-btn")[1].listeners.click[0]();
  press("ArrowRight");
  assert.strictEqual(handle.style.left, (50 + CFG.request.wipeStep * 100) + "%");
  assert.strictEqual(find("zk-cmp-before")[0].style.clipPath, "inset(0 " + (50 - CFG.request.wipeStep * 100) + "% 0 0)");
  press("Escape");
  assert.strictEqual(host.hidden, true);
});

test("wheel zoom moves both pictures the same way", async function () {
  const { ctx, EVENTS, find, c } = await mounted();
  ctx.bus.emit(EVENTS.compare, { open: true });
  c.setBox(400, 300);
  const imgs = find("zk-cmp-img");
  imgs.forEach((i) => Object.assign(i, { naturalWidth: 800, naturalHeight: 600 }));
  c.fit();
  const before = imgs.map((i) => i.style.transform);
  c.zoom(2, 100, 100);
  const after = imgs.map((i) => i.style.transform);
  assert.strictEqual(after[0], after[1]);
  assert.notStrictEqual(after[0], before[0]);
});

test("review: while open no key reaches the drawing under it (Delete, Ctrl+Z, tool letters); closed = all pass",
  async function () {
    const { ctx, EVENTS, press, stops } = await mounted();
    press("KeyV");
    assert.deepStrictEqual(stops, []);
    ctx.bus.emit(EVENTS.compare, { open: true });
    press("Delete");
    press("KeyZ");
    assert.deepStrictEqual(stops, ["Delete", "KeyZ"]);
  });

test("review: answers that arrive while open join the list, the shown one stays", async function () {
  const { ctx, EVENTS, find, request } = await mounted();
  ctx.bus.emit(EVENTS.compare, { open: true });
  const more = [{ key: "req_3:1", id: "req_3", n: 1, prompt: "x", seed: 1, src: "/s3", result: "/r3" }, ...ANSWERS];
  request.answers = () => more;
  ctx.bus.emit(EVENTS.request, { answers: 3, unseen: 1 });
  assert.match(find("zk-cmp-status")[0].textContent, /^req_2 .* 2 \/ 3$/);
});

test("review: markSeen that emits zk:request (the real requester) does not loop", async function () {
  const { ctx, EVENTS, request } = await mounted();
  let n = 0;
  request.markSeen = () => {
    n += 1;
    if (n < 50) {
      ctx.bus.emit(EVENTS.request, { answers: 2, unseen: 0 });
    }
  };
  ctx.bus.emit(EVENTS.compare, { open: true });
  assert.strictEqual(n, 1);
});

test("review: keys typed in a field (the name box) still work while compare is open", async function () {
  const { ctx, EVENTS, stops } = await mounted();
  ctx.bus.emit(EVENTS.compare, { open: true });
  const keys = globalThis.__lastKeys;
  assert.ok(Array.isArray(keys));
  const e = { code: "Enter", key: "Enter", target: { tagName: "INPUT" }, preventDefault: () => null,
    stopPropagation: () => stops.push("Enter") };
  keys.forEach((fn) => fn(e));
  assert.deepStrictEqual(stops, []);
});

test("live check 23:1x: the panel stretches its bar and picture box to full width (the host class centres items)",
  function () {
    const css = fs.readFileSync(path.join(WEB, "components", "compare", "compare.css"), "utf8");
    assert.match(css, /\[data-component="compare"\] \{[^}]*align-items:\s*stretch/);
  });

test("Koh voice 23:3x (wipe: the picture jumped while dragging): in wipe mode a drag anywhere moves only the " +
  "divider; the picture stays locked; the browser's own picture drag is stopped", async function () {
  const { ctx, EVENTS, find, c } = await mounted();
  ctx.bus.emit(EVENTS.compare, { open: true });
  find("zk-cmp-btn")[1].listeners.click[0]();
  c.setBox(400, 300);
  const box = find("zk-cmp-box")[0];
  const img = find("zk-cmp-before")[0].children[0];
  const before = img.style.transform;
  const ev = (x, y, extra) => Object.assign({ clientX: x, clientY: y, pointerId: 1, button: 0, target: img,
    preventDefault: () => null }, extra || {});
  box.listeners.pointerdown[0](ev(100, 100));
  box.listeners.pointermove[0](ev(300, 160));
  box.listeners.pointerup[0](ev(300, 160));
  assert.strictEqual(img.style.transform, before, "picture did not move");
  assert.strictEqual(find("zk-cmp-handle")[0].style.left, "75%", "divider follows the mouse");
  let stopped = false;
  box.listeners.dragstart[0]({ preventDefault: () => (stopped = true) });
  assert.ok(stopped);
  box.listeners.pointerdown[0](ev(300, 160, { button: 1 }));
  box.listeners.pointermove[0](ev(320, 170, { button: 1 }));
  assert.notStrictEqual(img.style.transform, before, "middle button still pans when zoomed in");
});

test("review: in wipe mode a right-button drag does nothing to the picture either", async function () {
  const { ctx, EVENTS, find, c } = await mounted();
  ctx.bus.emit(EVENTS.compare, { open: true });
  find("zk-cmp-btn")[1].listeners.click[0]();
  c.setBox(400, 300);
  const box = find("zk-cmp-box")[0];
  const img = find("zk-cmp-before")[0].children[0];
  const before = img.style.transform;
  const ev = (x, y) => ({ clientX: x, clientY: y, pointerId: 1, button: 2, target: img, preventDefault: () => null });
  box.listeners.pointerdown[0](ev(100, 100));
  box.listeners.pointermove[0](ev(300, 200));
  assert.strictEqual(img.style.transform, before);
});
