// V transform box (canvas module cv_transform_math.js, cv_transform_overlay.js, cv_tool_transform.js;
// docs/cv_transform.js.md, tests test_cv_transform_math.js / _flow.js): eight resize handles + a rotate handle on the
// chosen shape; edges stretch one axis, corners both, Shift keeps the ratio / snaps 15 degrees; Esc restores.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

function mod(name) {
  return import(pathToFileURL(path.join(__dirname, "..", "web", "js", name)).href);
}
const TF_TOL = { hit: 8, rotate: 28, min: 0.01, snap: 15 };

test("math: bounds incl. cubic extrema, fixed anchor, ratio lock, rotation maps handles too, degenerate paths",
  async function () {
    const M = await mod("zk_transform.js");
    const points = [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 70 }];
    const box = M.bounds({ points, kind: "poly", closed: true });
    assert.deepStrictEqual(box, { x: 10, y: 20, w: 100, h: 50 });
    const m = M.resize(box, [1, 1], { x: 210, y: 120 }, false, 0.01);
    assert.deepStrictEqual(M.mapPoints(points, m)[2], { x: 210, y: 120 });
    assert.deepStrictEqual(M.mapPoints(points, m)[0], points[0]);
    const locked = M.resize(box, [1, 1], { x: 210, y: 90 }, true, 0.01);
    assert.strictEqual(locked.a, locked.d);
    assert.strictEqual(M.mapPoints(points, M.resize(box, [-1, 0], { x: -90, y: 40 }, false, 0.01))[1].x, 110);
    const r = M.mapPoints([{ x: 10, y: 0, cx1: 20, cy1: 0, cx2: 0, cy2: 10 }], M.rotate({ x: 0, y: 0 }, Math.PI / 2))[0];
    assert.ok(Math.abs(r.x) < 1e-9 && Math.abs(r.y - 10) < 1e-9 && Math.abs(r.cy1 - 20) < 1e-9);
    const curve = { kind: "bezier", closed: false, points: [{ x: 0, y: 0 }, { x: 100, y: 0, cx1: 0, cy1: 100, cx2: 100, cy2: 100 }] };
    assert.strictEqual(M.bounds(curve).h, 75);
    const crossed = M.resize(box, [1, 1], { x: -100, y: -100 }, false, 0.01);
    assert.ok(crossed.a > 0 && crossed.d > 0, "crossing the anchor clamps, never mirrors");
    assert.strictEqual(M.resize({ x: 0, y: 0, w: 0, h: 100 }, [1, 1], { x: 0, y: 50 }, true, 0.01).d, 0.5);
    assert.strictEqual(M.resize({ x: 0, y: 0, w: 0.001, h: 100 }, [-1, -1], { x: 0, y: 0 }, false, 0.01).a, 1);
  });

async function fixture() {
  const T = await mod("zk_pentools.js");
  const F = await mod("zk_pentransform.js");
  const st = T.newState();
  st.doc.paths.push({ id: "p1", kind: "poly", closed: true, fill: "#888888", stroke: "none", stroke_width: 2,
    points: [{ x: 50, y: 50 }, { x: 250, y: 50 }, { x: 150, y: 200 }] });
  st.selected = "p1";
  return { T, F, st, pts: () => JSON.stringify(st.doc.paths[0].points) };
}

test("flow: corner resize keeps the far corner; rotate handle turns 90 deg; Esc restores; box inside moves",
  async function () {
    let { T, F, st, pts } = await fixture();
    const original = pts();
    assert.strictEqual(F.handlesOf(st, TF_TOL).length, 9);
    assert.ok(F.tfDown(st, { x: 250, y: 200 }, TF_TOL));
    F.tfMove(st, { x: 350, y: 275 }, {}, TF_TOL);
    T.penUp(st);
    assert.notStrictEqual(pts(), original);
    assert.strictEqual(st.doc.paths[0].points[0].x, 50);
    ({ T, F, st, pts } = await fixture());
    F.tfDown(st, { x: 150, y: 22 }, TF_TOL);
    F.tfMove(st, { x: 253, y: 125 }, {}, TF_TOL);
    assert.ok(Math.abs(st.doc.paths[0].points[0].x - 225) < 1e-9);
    ({ T, F, st, pts } = await fixture());
    F.tfDown(st, { x: 250, y: 200 }, TF_TOL);
    F.tfMove(st, { x: 330, y: 250 }, {}, TF_TOL);
    assert.ok(F.tfCancel(st));
    assert.strictEqual(pts(), original);
    assert.strictEqual(st.grab, null);
    assert.ok(F.tfDown(st, { x: 90, y: 175 }, TF_TOL), "inside the box = move");
    T.selMove(st, { x: 100, y: 185 });
    assert.strictEqual(st.doc.paths[0].points[0].x, 60);
  });

test("Shift snaps the rotation to 15 deg; back to the start = no change; nearest handle wins when zoomed out",
  async function () {
    const { F, st, pts } = await fixture();
    const original = pts();
    F.tfDown(st, { x: 150, y: 22 }, TF_TOL);
    F.tfMove(st, { x: 150 + 103 * Math.sin(Math.PI / 9), y: 125 - 103 * Math.cos(Math.PI / 9) }, { shiftKey: true }, TF_TOL);
    assert.ok(Math.abs(st.grab.matrix.b - Math.sin(Math.PI / 12)) < 1e-9);
    F.tfMove(st, { x: 150, y: 22 }, {}, TF_TOL);
    assert.strictEqual(pts(), original);
    F.tfCancel(st);
    const far = { hit: 16, rotate: 56, min: 0.01, snap: 15 };
    assert.deepStrictEqual(F.tfHit(st, { x: 264, y: 200 }, far).handle, [1, 1]);
  });
