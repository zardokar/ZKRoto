// Insert on a curve (Koh 14:39 "ทำเลย" on the open list): clicking a segment with P adds a point ON the line you
// see and keeps the shape: a cubic is split in two (de Casteljau), a straight segment gets the point projected.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

function mod(name) {
  return import(pathToFileURL(path.join(__dirname, "..", "web", "js", name)).href);
}

function curve() {
  return { id: "p1", kind: "bezier", closed: false, points: [{ x: 0, y: 0 },
    { x: 100, y: 0, cx1: 0, cy1: 100, cx2: 100, cy2: 100 }] };
}

test("split a cubic at the clicked place: the two halves trace the same curve", async function () {
  const S = await mod("zk_pensplit.js");
  const P = await mod("zk_penpath.js");
  const before = P.flattenPath(curve(), 64);
  const c = curve();
  const at = S.insertOnSeg(c, 1, { x: 50, y: 76 });
  assert.strictEqual(at, 1);
  assert.strictEqual(c.points.length, 3);
  assert.ok(Math.hypot(c.points[1].x - 50, c.points[1].y - 75) < 0.01, "the middle of the curve");
  for (const q of before) {
    assert.ok(P.pathDist(c, q, 64) < 0.5, "the new path passes through every old sample");
  }
});

test("a straight segment gets the point projected onto it; the closing segment goes at the end", async function () {
  const S = await mod("zk_pensplit.js");
  const sq = { id: "p2", kind: "poly", closed: true, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] };
  S.insertOnSeg(sq, 1, { x: 30, y: 4 });
  assert.deepStrictEqual(sq.points[1], { x: 30, y: 0 });
  const at = S.insertOnSeg(sq, 4, { x: 52, y: 48 });
  assert.strictEqual(at, 4);
  assert.deepStrictEqual(sq.points[4], { x: 50, y: 50 });
});

test("the nearest segment is measured on the curve, not on its chord", async function () {
  const S = await mod("zk_pensplit.js");
  const H = await mod("zk_penhit.js");
  const c = curve();
  c.points.push({ x: 100, y: 75 });
  assert.strictEqual(S.nearestOnPath(c, { x: 50, y: 74 }).seg, 1);
  const hit = H.hitPath({ paths: [c] }, { x: 50, y: 74 }, 6);
  assert.strictEqual(hit.segIndex, 1, "the chord of segment 2 is nearer, the curve of segment 1 is under the click");
});

test("P on a curve segment inserts with the split", async function () {
  const T = await mod("zk_pentools.js");
  const st = T.newState();
  st.doc.paths.push(curve());
  st.selected = "p1";
  st.tool = "pen";
  T.penDown(st, { x: 50, y: 76 }, {}, { line: 6, point: 11, bend: 4 });
  const pts = st.doc.paths[0].points;
  assert.strictEqual(pts.length, 3);
  assert.ok(Math.hypot(pts[1].x - 50, pts[1].y - 75) < 0.01);
  assert.ok(pts[2].cx1 !== undefined && pts[1].cx1 !== undefined);
});

test("review: a click past the end of a segment adds no zero-length duplicate point", async function () {
  const S = await mod("zk_pensplit.js");
  const line = { id: "p3", kind: "poly", closed: false, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] };
  assert.strictEqual(S.insertOnSeg(line, 1, { x: -50, y: 5 }), null);
  assert.strictEqual(line.points.length, 2);
});
