// Unit tests for web/js/zk_openpose.js (MediaPipe 33 -> OpenPose 18, limb list).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_openpose.js")).href;
const THRESHOLD = 0.3;

function load() {
  return import(MODULE);
}

// 33 points where point i sits at (i * 10, i * 10 + 1) with visibility 1
function mp33(vis) {
  const out = [];
  for (let i = 0; i < 33; i += 1) {
    out.push([i * 10, i * 10 + 1, vis === undefined ? 1 : vis]);
  }
  return out;
}

test("mapping table: OpenPose 18 joints from the MediaPipe indices of the design (5.1)", async function () {
  const o = await load();
  const op = o.toOpenPose(mp33(), THRESHOLD);
  assert.strictEqual(op.length, 18);
  const expected = { 0: 0, 2: 12, 3: 14, 4: 16, 5: 11, 6: 13, 7: 15, 8: 24, 9: 26, 10: 28, 11: 23, 12: 25, 13: 27, 14: 5, 15: 2, 16: 8, 17: 7 };
  for (const [opIndex, mpIndex] of Object.entries(expected)) {
    assert.deepStrictEqual(op[opIndex], [mpIndex * 10, mpIndex * 10 + 1, 1], `OP ${opIndex}`);
  }
});

test("neck = middle of the shoulders (11, 12), visibility = the lower shoulder", async function () {
  const o = await load();
  const pts = mp33();
  pts[11] = [100, 200, 0.9];
  pts[12] = [300, 220, 0.6];
  const op = o.toOpenPose(pts, THRESHOLD);
  assert.deepStrictEqual(op[1], [200, 210, 0.6]);
});

test("neck follows the shoulders: moving one shoulder moves the neck by half", async function () {
  const o = await load();
  const pts = mp33();
  const before = o.toOpenPose(pts, THRESHOLD)[1];
  pts[12] = [pts[12][0] + 40, pts[12][1] - 20, 1];
  const after = o.toOpenPose(pts, THRESHOLD)[1];
  assert.deepStrictEqual([after[0] - before[0], after[1] - before[1]], [20, -10]);
});

test("visibility under the threshold -> 0, 0, 0; a hidden shoulder hides the neck", async function () {
  const o = await load();
  const pts = mp33();
  pts[0] = [5, 5, 0.29];
  pts[11] = [1, 1, 0.1];
  const op = o.toOpenPose(pts, THRESHOLD);
  assert.deepStrictEqual(op[0], [0, 0, 0]);
  assert.deepStrictEqual(op[5], [0, 0, 0]);
  assert.deepStrictEqual(op[1], [0, 0, 0]);
  assert.deepStrictEqual(o.toOpenPose(mp33(0.3), THRESHOLD)[0], [0, 1, 0.3], "exactly the threshold is kept");
});

test("a point already hidden (visibility 0, e.g. behind the eye) stays hidden", async function () {
  const o = await load();
  const pts = mp33();
  pts[16] = [0, 0, 0];
  assert.deepStrictEqual(o.toOpenPose(pts, 0)[4], [0, 0, 0]);
});

test("LIMBS: the 17 limbs of the annotator, 0-based", async function () {
  const o = await load();
  assert.deepStrictEqual(o.LIMBS, [[1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [1, 8], [8, 9], [9, 10], [1, 11],
    [11, 12], [12, 13], [1, 0], [0, 14], [14, 16], [0, 15], [15, 17]]);
});

test("visibleCount counts joints with c > 0", async function () {
  const o = await load();
  assert.strictEqual(o.visibleCount([[1, 1, 0.5], [0, 0, 0], [2, 2, 1]]), 2);
});
