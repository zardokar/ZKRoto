// Colour maths and the colour wheel, ported from Koh's canvas module (atdd/js/test_cv_color.js): hex -> hsv -> hex
// must give the same hex back (else dragging the wheel slowly shifts the colour); samples cover all six 60-degree
// sectors; ring angle 0 at the top, clockwise (= CSS conic-gradient); triangle A pure, B white, C black.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

function mod(name) {
  return import(pathToFileURL(path.join(__dirname, "..", "web", "js", name)).href);
}
function near(a, b, tol) {
  return Math.abs(a - b) <= (tol === undefined ? 1e-6 : tol);
}
const SAMPLES = ["#000000", "#ffffff", "#7f7f7f", "#ff0000", "#ff8000", "#ffff00", "#80ff00", "#00ff00", "#00ff80",
  "#00ffff", "#0080ff", "#0000ff", "#8000ff", "#ff00ff", "#ff0080", "#8a8a92", "#ececee", "#6f8fbf", "#e0726c",
  "#123456", "#010203"];

test("hex <-> rgb reads exact bytes; bad hex = null; out of range is clamped", async function () {
  const H = await mod("zk_hsv.js");
  assert.deepStrictEqual(H.hexToRgb("#123456"), { r: 18, g: 52, b: 86 });
  assert.strictEqual(H.hexToRgb("#ABCDEF").r, 171);
  assert.strictEqual(H.hexToRgb("#12"), null);
  assert.strictEqual(H.rgbToHex({ r: 1, g: 2, b: 3 }), "#010203");
  assert.strictEqual(H.rgbToHex({ r: 300, g: -5, b: 128 }), "#ff0080");
});

test("samples cover all six sectors and every one goes hex -> hsv -> hex unchanged", async function () {
  const H = await mod("zk_hsv.js");
  const sectors = new Set();
  for (const hex of SAMPLES) {
    const hsv = H.hexToHsv(hex);
    if (hsv.s > 0.01 && hsv.v > 0.01) {
      sectors.add(Math.floor(hsv.h / 60) % 6);
    }
    assert.strictEqual(H.hsvToHex(hsv), hex, hex);
  }
  assert.strictEqual(sectors.size, 6);
  assert.ok(near(H.hexToHsv("#00ff00").h, 120) && near(H.hexToHsv("#7f7f7f").s, 0));
});

test("ring: angle 0 at the top, 90 at the right, read back; centre and outside are not the ring", async function () {
  const W = await mod("zk_wheel.js");
  const mid = W.WHEEL_SIZE / 2;
  const top = W.wheelPoint(0, 90);
  assert.ok(near(top.x, mid) && near(top.y, mid - 90));
  assert.ok(near(W.wheelAngle(W.wheelPoint(90, 90)), 90, 1e-9));
  assert.ok(W.onRing(W.wheelPoint(45, 88)));
  assert.strictEqual(W.onRing({ x: mid, y: mid }), false);
  assert.strictEqual(W.onRing({ x: mid, y: mid - 130 }), false);
});

test("triangle: A = pure, B = white, C = black at any hue; (s, v) round trip; outside is clamped", async function () {
  const W = await mod("zk_wheel.js");
  for (const hue of [0, 16, 120, 359]) {
    const v = W.triVerts(hue);
    const a = W.triToSv(v.a, hue);
    const b = W.triToSv(v.b, hue);
    assert.ok(near(a.s, 1, 1e-9) && near(a.v, 1, 1e-9) && near(b.s, 0, 1e-9) && near(b.v, 1, 1e-9));
    assert.ok(near(W.triToSv(v.c, hue).v, 0, 1e-9));
  }
  for (const pair of [[1, 1], [0, 1], [0.5, 0.5], [0.97, 0.16]]) {
    const back = W.triToSv(W.svToTri(pair[0], pair[1], 16), 16);
    assert.ok(near(back.s, pair[0], 1e-9) && near(back.v, pair[1], 1e-9), String(pair));
  }
  const far = W.triToSv({ x: -500, y: -500 }, 16);
  assert.ok(far.s >= 0 && far.s <= 1 && far.v >= 0 && far.v <= 1);
  assert.strictEqual(W.triPoints(16).split(" ").length, 3);
  assert.strictEqual(W.wheelTarget(W.wheelPoint(10, 88), 200, 0.5, 0.5), "ring");
});
