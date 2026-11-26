// Pen toolbar (web/components/penbar/): one vertical bar like the canvas module's left bar (canvas.html
// nav.cv-toolbar, cv_head.js cvToolButton): icon + key letter, the chosen tool lit, themed tooltip (z-ui: no title).
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
const CSS = fs.readFileSync(path.join(WEB, "components", "penbar", "penbar.css"), "utf8");
const HTML = fs.readFileSync(path.join(WEB, "index.html"), "utf8");

function url(...p) {
  return pathToFileURL(path.join(WEB, ...p)).href;
}

async function mounted() {
  install();
  const { createBus, EVENTS } = await import(url("js", "zk_events.js"));
  const { mount } = await import(url("components", "penbar", "penbar.js"));
  const host = document.createElement("div");
  const calls = [];
  let now = "select";
  const parts = { pen: { tool: function (name) {
    if (name === undefined) {
      return now;
    }
    calls.push(name);
    now = name;
    return now;
  } } };
  const ctx = { cfg: CFG, k: K, bus: createBus() };
  mount(host, ctx, parts);
  return { host, calls, ctx, EVENTS };
}

test("one button per tool in config order, each with an SVG icon, its key letter and a themed tip (no title)",
  async function () {
    const { host } = await mounted();
    const buttons = host.children;
    assert.deepStrictEqual(buttons.map(function (b) {
      return b.dataset.tool;
    }), CFG.pen.tools);
    buttons.forEach(function (b) {
      const tool = K.ui.penTools[b.dataset.tool];
      assert.match(b.innerHTML, /^<img class="zk-tool-ico" src="data:image\/svg\+xml,[^"]+" alt="">/);
      assert.match(b.innerHTML, new RegExp(`<span class="zk-tool-key">${tool.key}</span>`));
      assert.strictEqual(b.attributes["data-tip"], `${tool.label} (${tool.key})`);
      assert.strictEqual(b.attributes["aria-label"], tool.label);
      assert.strictEqual(b.attributes.title, undefined);
      assert.strictEqual(b.attributes["aria-pressed"], String(b.dataset.tool === "select"), "the current tool is lit");
    });
  });

test("click chooses the tool; a click on the lit tool keeps it (canvas cvToolActivate); the bus lights the right button",
  async function () {
    const { host, calls, ctx, EVENTS } = await mounted();
    const [select, , pen] = host.children;
    pen.listeners.click[0]();
    ctx.bus.emit(EVENTS.pen, { tool: "pen" });
    assert.strictEqual(pen.attributes["aria-pressed"], "true");
    assert.strictEqual(select.attributes["aria-pressed"], "false");
    pen.listeners.click[0]();
    select.listeners.click[0]();
    ctx.bus.emit(EVENTS.pen, { tool: "select" });
    assert.deepStrictEqual(calls, ["pen", "pen", "select"]);
    assert.strictEqual(pen.attributes["aria-pressed"], "false");
    assert.strictEqual(select.attributes["aria-pressed"], "true");
  });

test("texts of the bar live in constants (labels and keys = the canvas module's V / A / P / Z / I)", function () {
  assert.deepStrictEqual(Object.keys(K.ui.penTools).sort(), ["eyedrop", "pen", "point", "select", "zoom"]);
  assert.deepStrictEqual(CFG.pen.tools.map(function (n) {
    return K.ui.penTools[n].key;
  }), ["V", "A", "P", "Z", "I"]);
});

test("feel (z-ui): hover sinks 1px, press sinks 3px with an inset shadow, about 100 ms; lit = accent; sizes from the theme",
  function () {
    assert.match(CSS, /\.zk-tool:hover\s*\{[^}]*translateY\(1px\)/);
    assert.match(CSS, /\.zk-tool:active\s*\{[^}]*translateY\(3px\)[^}]*var\(--zk-tool-shadow-press\)/);
    assert.match(CSS, /transition:[^;]*100ms/);
    assert.match(CSS, /\.zk-tool\[aria-pressed="true"\]\s*\{[^}]*var\(--zk-acc\)/);
    assert.match(CSS, /\[data-tip\]:hover::after,\s*\.zk-tool\[data-tip\]:focus-visible::after\s*\{[^}]*attr\(data-tip\)/,
      "tip on hover and on keyboard focus");
    for (const v of ["--zk-tool-size", "--zk-toolbar-width", "--zk-icon-size", "--zk-font-key"]) {
      assert.match(CSS, new RegExp(`var\\(${v}\\)`), v);
    }
  });

test("page: a tools slot left of the stage, and a pen canvas over the pose overlay", function () {
  assert.match(HTML, /<nav class="zk-slot zk-toolslot" data-slot="tools"><\/nav>\s*<div id="stagecol">\s*<div id="stage">/);
  assert.match(HTML, /<canvas id="overlay"><\/canvas>\s*<canvas id="pen"><\/canvas>/);
  // wf_modes round 1 + live check 2026-11-26: the zoom bar (shown while Z is on) sits under the tools in both modes.
  assert.deepStrictEqual(CFG.layout.slots.tools, ["penbar", "colorbox", "picker", "rototools", "zoombar"]);
  const page = fs.readFileSync(path.join(WEB, "layout", "zk_page.css"), "utf8");
  assert.match(page, /\.zk-toolslot\s*\{[^}]*position: relative;[^}]*z-index: 2;/, "tooltips over the stage (seen 12:1x)");
});
