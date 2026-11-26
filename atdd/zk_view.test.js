// Zoom / pan of the source picture (web/js/zk_view.js), the canvas module's rules (cv_data.js cvZoomView,
// cvPanView, cvFitView, CV_ZOOM_MIN / MAX): zoom keeps the point under the mouse where it is; limits clamp; 0 = fit.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_view.js")).href;
const LIM = { min: 0.05, max: 40 };

// Screen position of a picture point q (offset from the picture centre, unscaled) under a view.
function screenOf(v, centre, q) {
  return { x: centre.x + v.tx + v.s * q.x, y: centre.y + v.ty + v.s * q.y };
}

test("fit = scale 1, no shift; css of a view", async function () {
  const { fitView, viewCss } = await import(MODULE);
  assert.deepStrictEqual(fitView(), { s: 1, tx: 0, ty: 0 });
  assert.strictEqual(viewCss({ s: 2, tx: 10, ty: -5 }), "translate(10px, -5px) scale(2)");
});

test("zoom at the mouse keeps the picture point under the mouse in place (in and out)", async function () {
  const { zoomAt } = await import(MODULE);
  const centre = { x: 400, y: 300 };
  let v = { s: 1, tx: 0, ty: 0 };
  const mouse = { x: 520, y: 210 };
  const q = { x: (mouse.x - centre.x - v.tx) / v.s, y: (mouse.y - centre.y - v.ty) / v.s };
  v = zoomAt(v, { x: mouse.x - (centre.x + v.tx), y: mouse.y - (centre.y + v.ty) }, 1.6, LIM);
  let at = screenOf(v, centre, q);
  assert.ok(Math.abs(at.x - mouse.x) < 1e-9 && Math.abs(at.y - mouse.y) < 1e-9, JSON.stringify(at));
  v = zoomAt(v, { x: mouse.x - (centre.x + v.tx), y: mouse.y - (centre.y + v.ty) }, 1 / 1.12, LIM);
  at = screenOf(v, centre, q);
  assert.ok(Math.abs(at.x - mouse.x) < 1e-9 && Math.abs(at.y - mouse.y) < 1e-9);
});

test("zoom stops at the limits (no jump of the shift when clamped)", async function () {
  const { zoomAt } = await import(MODULE);
  const big = zoomAt({ s: 39, tx: 0, ty: 0 }, { x: 100, y: 0 }, 2, LIM);
  assert.strictEqual(big.s, 40);
  assert.ok(Math.abs(big.tx - 100 * (1 - 40 / 39)) < 1e-9);
  assert.strictEqual(zoomAt({ s: 0.05, tx: 0, ty: 0 }, { x: 0, y: 0 }, 0.5, LIM).s, 0.05);
});

test("pan moves by the screen delta", async function () {
  const { panBy } = await import(MODULE);
  assert.deepStrictEqual(panBy({ s: 2, tx: 1, ty: 2 }, 30, -4), { s: 2, tx: 31, ty: -2 });
});
