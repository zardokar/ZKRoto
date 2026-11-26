// Zoom bar (canvas module canvas.html #cvZoomGrp, cv_head.js, cv_menu.js cvZoomVisible): Fit (0) | - | % | +,
// shown only while the Z tool is on; - and + zoom x1.25 at the stage centre; the % follows the view (Koh voice
// 2026-11-24 13:4x: after zooming there was no way back to the fitted picture).
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
  const { mount } = await import(url("components", "zoombar", "zoombar.js"));
  const host = document.createElement("div");
  const calls = [];
  const watchers = [];
  let tool = "select";
  let s = 1;
  const view = { fit: function () {
    calls.push(["fit"]);
    s = 1;
    watchers.forEach((fn) => fn());
  }, zoomCenter: function (f) {
    calls.push(["center", f]);
    s *= f;
    watchers.forEach((fn) => fn());
  }, percent: function () {
    return Math.round(s * 100);
  }, onChange: function (fn) {
    watchers.push(fn);
  } };
  const parts = { pen: { view, tool: function () {
    return tool;
  } } };
  const ctx = { cfg: CFG, k: K, bus: createBus() };
  mount(host, ctx, parts);
  return { host, calls, ctx, EVENTS, setTool: function (t) {
    tool = t;
    ctx.bus.emit(EVENTS.pen, { tool: t });
  } };
}

test("hidden unless the Z tool is on (cvZoomVisible)", async function () {
  const { host, setTool } = await mounted();
  assert.strictEqual(host.hidden, true);
  setTool("zoom");
  assert.strictEqual(host.hidden, false);
  setTool("pen");
  assert.strictEqual(host.hidden, true);
});

test("Fit, -, %, + in canvas order; Fit fits, - / + zoom x1.25 at the centre; the % follows", async function () {
  const { host, calls, setTool } = await mounted();
  setTool("zoom");
  const [fit, out, label, inn] = host.children;
  assert.strictEqual(fit.textContent, K.ui.zoomFit);
  assert.strictEqual(label.textContent, "100%");
  inn.listeners.click[0]();
  assert.strictEqual(label.textContent, "125%");
  out.listeners.click[0]();
  fit.listeners.click[0]();
  assert.deepStrictEqual(calls, [["center", CFG.pen.zoomStep], ["center", 1 / CFG.pen.zoomStep], ["fit"]]);
  assert.strictEqual(label.textContent, "100%");
  assert.strictEqual(CFG.pen.zoomStep, 1.25);
  for (const b of [fit, out, inn]) {
    assert.ok(b.attributes["data-tip"], "themed tip");
    assert.strictEqual(b.attributes.title, undefined);
  }
});
