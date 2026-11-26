// Colour picker (canvas cv_picker.js, cv_pickview.js, cv_wheel.js; docs/cv_picker.js.md): one box with the hue ring,
// the S/V triangle, opacity, the hex field and the eyedropper; opened by a click on the Fill / Stroke box, closed
// by a click outside or its close button; the title says which square it edits.
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
  const { mount } = await import(url("components", "picker", "picker.js"));
  const host = document.createElement("div");
  const calls = [];
  const style = { fill: "#ff0000", stroke: "#ececee", front: "fill", fillOp: 1, strokeOp: 0.5 };
  const color = { style: () => Object.assign({}, style), apply: (h) => calls.push(["apply", h]) && true,
    opacity: (v) => calls.push(["opacity", v]) };
  const pen = { color, tool: (n) => calls.push(["tool", n]) };
  const ctx = { cfg: CFG, k: K, bus: createBus() };
  const api = mount(host, ctx, { pen });
  return { host, calls, ctx, EVENTS, style, api };
}

test("closed at start; zk:picker opens it with the front colour in the hex field and the right title", async function () {
  const { host, ctx, EVENTS, api } = await mounted();
  assert.strictEqual(host.hidden, true);
  ctx.bus.emit(EVENTS.picker, { open: true });
  assert.strictEqual(host.hidden, false);
  assert.strictEqual(api.parts.title.textContent, K.ui.color.pickFill);
  assert.strictEqual(api.parts.hex.value, "ff0000");
  assert.strictEqual(api.parts.opacity.value, "100");
  ctx.bus.emit(EVENTS.picker, { open: false });
  assert.strictEqual(host.hidden, true);
});

test("hex field: Enter applies a good colour (with or without #), a bad one is marked and not applied", async function () {
  const { calls, ctx, EVENTS, api } = await mounted();
  ctx.bus.emit(EVENTS.picker, { open: true });
  const hex = api.parts.hex;
  hex.value = "00ff80";
  hex.listeners.keydown[0]({ key: "Enter", preventDefault: () => null });
  hex.value = "#12";
  hex.listeners.keydown[0]({ key: "Enter", preventDefault: () => null });
  assert.deepStrictEqual(calls, [["apply", "#00ff80"]]);
  assert.ok(hex.classNames.includes("zk-bad"));
});

test("opacity slider sets the front square's opacity; eyedropper = tool I and the box closes", async function () {
  const { host, calls, ctx, EVENTS, api } = await mounted();
  ctx.bus.emit(EVENTS.picker, { open: true });
  api.parts.opacity.value = "40";
  api.parts.opacity.listeners.input[0]();
  api.parts.eye.listeners.click[0]();
  assert.deepStrictEqual(calls, [["opacity", 0.4], ["tool", "eyedrop"]]);
  assert.strictEqual(host.hidden, true);
});

test("wheel: a ring position sets the hue, a triangle position sets S/V, the colour is applied live", async function () {
  const { calls, ctx, EVENTS, api } = await mounted();
  const W = await import(url("js", "zk_wheel.js"));
  ctx.bus.emit(EVENTS.picker, { open: true });
  api.pickAt(W.wheelPoint(120, 88));
  assert.strictEqual(calls.pop()[1], "#00ff00", "ring at 120 deg on pure red = pure green");
  api.pickAt(W.triVerts(120).b, "tri");
  assert.strictEqual(calls.pop()[1], "#ffffff", "triangle corner B = white");
  const css = fs.readFileSync(path.join(WEB, "components", "picker", "picker.css"), "utf8");
  assert.match(css, /var\(--zk-hue-ring\)/);
  assert.match(css, /closest-side/, "ring mask measured to the visible circle (canvas bug)");
});
