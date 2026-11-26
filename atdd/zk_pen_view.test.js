// Zoom / pan through the pen facade (canvas cv_tool_view.js, cv_stage_pointer.js, cv_key_common.js): Z click zooms in
// by zoomClick at the mouse, Alt+click out; Space held = temporary pan (hand), drag pans; 0 = fit; a new picture fits.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { CFG, setup, ev, key } = require("./pen_kit.js");

test("Z click zooms in at the mouse, Alt+click zooms out (cvZoomDown)", async function () {
  const { pen, calls } = await setup();
  pen.tool("zoom");
  pen.down(ev(100, 50));
  pen.up(ev(100, 50));
  pen.down(ev(100, 50, { altKey: true }));
  pen.up(ev(100, 50, { altKey: true }));
  assert.deepStrictEqual(calls, [["zoom", 110, 70, CFG.pen.zoomClick], ["zoom", 110, 70, 1 / CFG.pen.zoomClick]]);
});

test("Space held: hand cursor, a drag pans by the screen delta, the tool comes back on release", async function () {
  const { pen, calls } = await setup();
  pen.tool("pen");
  pen.key(key("Space", { key: " " }));
  assert.strictEqual(pen.cursor(), "hand_open");
  pen.down(ev(10, 10));
  assert.strictEqual(pen.cursor(), "hand_drag");
  pen.move(ev(30, 5));
  pen.move(ev(35, 15));
  pen.up(ev(35, 15));
  pen.keyUp(key("Space", { key: " " }));
  assert.deepStrictEqual(calls, [["pan", 20, -5], ["pan", 5, 10]]);
  assert.strictEqual(pen.doc().paths.length, 0, "no point placed while panning");
  assert.strictEqual(pen.tool(), "pen");
  assert.strictEqual(pen.cursor(), "pen");
});

test("0 fits; a new picture (reset) fits too", async function () {
  const { pen, calls } = await setup();
  pen.key(key("Digit0", { key: "0" }));
  pen.reset();
  assert.deepStrictEqual(calls, [["fit"], ["fit"]]);
});

function el() {
  return { style: {}, listeners: {}, addEventListener: function (n, fn) {
    this.listeners[n] = fn;
  }, getBoundingClientRect: function () {
    return { left: 100, top: 50, width: 400, height: 300 };
  } };
}

test("page view: zoom / pan / fit move the picture layers (video, still, overlay); the pen canvas stays put " +
  "and is drawn sharp instead (Koh 13:57: the vector broke up when zoomed); wheel zooms at the mouse", async function () {
  const { createPenView } = await import(pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_penview.js")).href);
  const els = { video: el(), still: el(), overlay: el(), pen: el(), srcpane: el() };
  const view = createPenView({ cfg: CFG, el: els });
  view.zoomAtClient(300, 200, 2);
  for (const name of ["video", "still", "overlay"]) {
    assert.strictEqual(els[name].style.transform, "translate(0px, 0px) scale(2)", name);
  }
  assert.strictEqual(els.pen.style.transform, undefined, "the pen canvas is never scaled by CSS");
  view.panBy(10, -4);
  assert.strictEqual(els.still.style.transform, "translate(10px, -4px) scale(2)");
  view.fit();
  assert.strictEqual(els.video.style.transform, "translate(0px, 0px) scale(1)");
  let prevented = false;
  els.srcpane.listeners.wheel({ deltaY: -1, clientX: 300, clientY: 200, preventDefault: function () {
    prevented = true;
  } });
  assert.ok(prevented);
  assert.strictEqual(els.still.style.transform, `translate(0px, 0px) scale(${CFG.pen.zoomWheel})`);
  assert.deepStrictEqual(view.box(), { left: 100, top: 50, width: 400, height: 300 }, "box = the shown picture");
});

test("sharp pen: the canvas covers the pane at screen pixels x devicePixelRatio and draws picture pixels through " +
  "a transform (picture -> screen); a click maps back to picture pixels", async function () {
  const { createPen } = await import(pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_pen.js")).href);
  const { createBus } = await import(pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_events.js")).href);
  const calls = [];
  const g = new Proxy({}, { get: function (t, name) {
    return function (...args) {
      calls.push([name, ...args]);
    };
  }, set: function () {
    return true;
  } });
  const canvas = { width: 0, height: 0, style: {}, getContext: () => g, setPointerCapture: () => null,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 1000, height: 700 }) };
  const view = { box: () => ({ left: 110, top: 70, width: 800, height: 600 }), backing: function (c) {
    c.width = 2000;
    c.height = 1400;
    return { dpr: 2, left: 10, top: 20 };
  }, onChange: () => null, fit: () => null };
  const ctx = { cfg: CFG, k: {}, el: { pen: canvas }, bus: createBus() };
  const pen = createPen(ctx, view);
  pen.resize(400, 300);
  assert.deepStrictEqual([canvas.width, canvas.height], [2000, 1400], "screen resolution, not picture size");
  const sets = calls.filter((c) => c[0] === "setTransform");
  assert.deepStrictEqual(sets.slice(-2), [["setTransform", 1, 0, 0, 1, 0, 0], ["setTransform", 4, 0, 0, 4, 200, 100]]);
  pen.tool("pen");
  pen.down({ clientX: 190, clientY: 110, pointerId: 1, button: 0, isPrimary: true, preventDefault: () => null });
  assert.deepStrictEqual(pen.doc().paths[0].points[0], { x: 40, y: 20 });
});
