// Unit tests for web/js/zk_framing.js (fit: skeleton box on the margins; true camera: no change).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_framing.js")).href;
const SIZE = [832, 1216];
const MARGINS = { top: 0.1, bottom: 0.09, sides: 0.05 };
const EPS = 1e-9;

function load() {
  return import(MODULE);
}

function box(points) {
  const vis = points.filter(function (p) {
    return p[2] > 0;
  });
  const xs = vis.map(function (p) {
    return p[0];
  });
  const ys = vis.map(function (p) {
    return p[1];
  });
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function near(a, b, msg) {
  assert.ok(Math.abs(a - b) <= EPS, `${msg} ${a} != ${b}`);
}

test("tall skeleton: top and bottom on the margins, centred left / right", async function () {
  const f = await load();
  const pts = [[100, 100, 1], [200, 500, 1], [150, 300, 0.9]];
  const out = f.applyTransform(pts, f.fitTransform(pts, SIZE, MARGINS));
  const b = box(out);
  near(b[1], 121.6, "top");
  near(b[3], 1216 - 109.44, "bottom");
  near((b[0] + b[2]) / 2, 416, "centre x");
});

test("wide skeleton: sides on the margin, centred between the top and bottom margins", async function () {
  const f = await load();
  const pts = [[0, 0, 1], [1000, 100, 1]];
  const out = f.applyTransform(pts, f.fitTransform(pts, SIZE, MARGINS));
  const b = box(out);
  near(b[0], 41.6, "left");
  near(b[2], 832 - 41.6, "right");
  near((b[1] + b[3]) / 2, (121.6 + 1216 - 109.44) / 2, "centre y");
});

test("hidden joints do not count for the box and stay 0, 0, 0", async function () {
  const f = await load();
  const pts = [[100, 100, 1], [200, 500, 1], [5000, -5000, 0], [0, 0, 0]];
  const tr = f.fitTransform(pts, SIZE, MARGINS);
  const out = f.applyTransform(pts, tr);
  near(box(out)[1], 121.6, "top");
  assert.deepStrictEqual(out[2], [0, 0, 0]);
  assert.deepStrictEqual(out[3], [0, 0, 0]);
});

test("fewer than two visible joints, or a box of size 0: identity (no NaN)", async function () {
  const f = await load();
  assert.deepStrictEqual(f.fitTransform([[10, 10, 1], [0, 0, 0]], SIZE, MARGINS), { s: 1, tx: 0, ty: 0 });
  assert.deepStrictEqual(f.fitTransform([[10, 10, 1], [10, 10, 1]], SIZE, MARGINS), { s: 1, tx: 0, ty: 0 });
});

test("frame(points, mode): 'true' keeps the projection, 'fit' moves it; both layers use one transform", async function () {
  const f = await load();
  const op = [[100, 100, 1], [200, 500, 1]];
  const mp = [[150, 300, 1], [0, 0, 0]];
  const same = f.frame({ op, mp }, "true", SIZE, MARGINS);
  assert.deepStrictEqual(same, { op, mp });
  const fit = f.frame({ op, mp }, "fit", SIZE, MARGINS);
  const tr = f.fitTransform(op, SIZE, MARGINS);
  assert.deepStrictEqual(fit.mp, f.applyTransform(mp, tr));
  assert.deepStrictEqual(fit.op, f.applyTransform(op, tr));
});

test("edge-on skeleton (no width): fitted by its height alone, not left unframed", async function () {
  const f = await load();
  const pts = [[300, 100, 1], [300, 500, 1]];
  const out = f.applyTransform(pts, f.fitTransform(pts, SIZE, MARGINS));
  near(box(out)[1], 121.6, "top");
  near(box(out)[3], 1216 - 109.44, "bottom");
  near(out[0][0], 416, "centred");
});

test("frame(..., fixed): 'fit' with a given transform uses it as it is (one framing for a frame range)", async function () {
  const f = await load();
  const layers = { op: [[10, 20, 1], [30, 60, 1], [0, 0, 0]], mp: [[10, 20, 1]] };
  const fixed = { s: 2, tx: 5, ty: -3 };
  const out = f.frame(layers, "fit", SIZE, MARGINS, fixed);
  assert.deepStrictEqual(out.op, [[25, 37, 1], [65, 117, 1], [0, 0, 0]]);
  assert.deepStrictEqual(out.mp, [[25, 37, 1]]);
  assert.deepStrictEqual(f.frame(layers, "true", SIZE, MARGINS, fixed), layers, "true camera ignores it");
});

test("rangeFit: one transform from the joints of every frame puts the union box on the margins", async function () {
  const f = await load();
  const a = [[100, 100, 1], [200, 400, 1]];
  const b = [[150, 50, 1], [400, 300, 1], [999, 999, 0]];
  const tr = f.rangeFit([a, b], SIZE, MARGINS);
  assert.deepStrictEqual(tr, f.fitTransform(a.concat(b), SIZE, MARGINS));
  const all = box(f.applyTransform(a.concat(b), tr));
  assert.ok(Math.abs(all[1] - SIZE[1] * MARGINS.top) < 1e-6 || Math.abs(all[0] - SIZE[0] * MARGINS.sides) < 1e-6);
});
