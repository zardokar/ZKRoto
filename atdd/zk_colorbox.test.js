// Fill / Stroke box under the tool bar (canvas.html #cvColorBox, cv_color.js, docs/cv_color.js.md): stroke square
// drawn as a hollow ring, fill square solid, the front one outlined; a click brings a square to the front and
// opens the picker; swap (X) and no colour (/) buttons; "none" shows a red strike.
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
  const { createBus, EVENTS } = await import(url("js", "zk_events.js"));
  const { mount } = await import(url("components", "colorbox", "colorbox.js"));
  const host = document.createElement("div");
  const calls = [];
  let style = { fill: "#8a8a92", stroke: "#ececee", front: "fill", fillOp: 1, strokeOp: 1 };
  const color = { style: () => Object.assign({}, style), front: function (w) {
    calls.push(["front", w]);
    style.front = w;
  }, swap: () => calls.push(["swap"]), apply: (h) => calls.push(["apply", h]) };
  const ctx = { cfg: CFG, k: K, bus: createBus() };
  const opened = [];
  ctx.bus.on(EVENTS.picker, (d) => opened.push(d.open));
  mount(host, ctx, { pen: { color } });
  return { host, calls, ctx, EVENTS, opened, set: function (s) {
    style = s;
    ctx.bus.emit(EVENTS.color, s);
  } };
}

test("stroke ring, fill square, swap, none - in canvas order; fill in front at start; themed tips", async function () {
  const { host } = await mounted();
  const [stroke, fill, swap, none] = host.children;
  assert.strictEqual(fill.style.backgroundColor, "#8a8a92");
  assert.strictEqual(stroke.style.borderColor, "#ececee");
  assert.strictEqual(stroke.style.backgroundColor, "transparent", "hollow ring = the stroke");
  assert.ok(fill.classNames.includes("zk-front"));
  assert.ok(!stroke.classNames.includes("zk-front"));
  for (const b of [stroke, fill, swap, none]) {
    assert.ok(b.attributes["data-tip"]);
    assert.strictEqual(b.attributes.title, undefined);
  }
  assert.match(swap.innerHTML, /<svg/);
});

test("click a square = front + open the picker (Koh 2026-08-18: one click); swap and none act", async function () {
  const { host, calls, opened } = await mounted();
  const [stroke, , swap, none] = host.children;
  stroke.listeners.click[0]();
  swap.listeners.click[0]();
  none.listeners.click[0]();
  assert.deepStrictEqual(calls, [["front", "stroke"], ["swap"], ["apply", "none"]]);
  assert.deepStrictEqual(opened, [true]);
});

test("the box follows the pen (zk:color); none = red strike, not black", async function () {
  const { host, set } = await mounted();
  set({ fill: "none", stroke: "#ff0000", front: "stroke", fillOp: 1, strokeOp: 1 });
  const [stroke, fill] = host.children;
  assert.ok(fill.classNames.includes("zk-none"));
  assert.strictEqual(fill.style.backgroundColor, "transparent");
  assert.strictEqual(stroke.style.borderColor, "#ff0000");
  assert.ok(stroke.classNames.includes("zk-front"));
  const css = fs.readFileSync(path.join(WEB, "components", "colorbox", "colorbox.css"), "utf8");
  assert.match(css, /\.zk-none\s*\{[^}]*var\(--zk-none-mark\)/);
  assert.deepStrictEqual(CFG.layout.slots.tools.slice(0, 2), ["penbar", "colorbox"]);
});
