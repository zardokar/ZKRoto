// A = direct selection with curves (Koh 2026-11-24 14:20 "กด A แล้ว ไม่ขึ้นเครื่องมือ Curve", 14:26 "ทำต่อเลย",
// Illustrator Direct Selection): a chosen point shows its two handles; dragging a handle bends the curve (the
// other handle turns with it, Alt = only this one); Alt+drag on a corner pulls handles out; a moved point takes them.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

function mod(name) {
  return import(pathToFileURL(path.join(__dirname, "..", "web", "js", name)).href);
}
const TOL = { line: 6, point: 11, bend: 4 };

async function fixture() {
  const T = await mod("zk_pentools.js");
  const C = await mod("zk_pencurve.js");
  const st = T.newState();
  st.tool = "point";
  st.doc.paths.push({ id: "p1", kind: "poly", closed: false, fill: "none", stroke: "#000000", stroke_width: 2,
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }] });
  return { T, C, st, pts: () => st.doc.paths[0].points };
}

test("Alt+drag on a corner pulls both handles out (smooth point); the shape becomes a curve", async function () {
  const { T, C, st, pts } = await fixture();
  assert.ok(C.curveDown(st, { x: 100, y: 0 }, { altKey: true }, TOL));
  C.curveMove(st, { x: 140, y: 30 }, { altKey: true });
  T.penUp(st);
  const p = pts();
  assert.strictEqual(st.doc.paths[0].kind, "bezier");
  assert.deepStrictEqual([p[2].cx1, p[2].cy1], [140, 30], "out handle = the mouse");
  assert.deepStrictEqual([p[1].cx2, p[1].cy2], [60, -30], "in handle = mirrored");
  assert.deepStrictEqual(C.handlesOf(st.doc.paths[0], 1), { in: { x: 60, y: -30 }, out: { x: 140, y: 30 } });
});

test("a chosen point shows its handles; drag one = bend, the other turns opposite (length kept); Alt = alone",
  async function () {
    const { T, C, st, pts } = await fixture();
    C.curveDown(st, { x: 100, y: 0 }, { altKey: true }, TOL);
    C.curveMove(st, { x: 140, y: 0 }, { altKey: true });
    T.penUp(st);
    T.ptDown(st, { x: 100, y: 0 }, TOL);
    T.penUp(st);
    assert.deepStrictEqual(st.active, { path: "p1", index: 1 });
    assert.ok(C.curveDown(st, { x: 141, y: 1 }, {}, TOL), "press on the out handle");
    C.curveMove(st, { x: 100, y: 40 }, {});
    T.penUp(st);
    assert.deepStrictEqual([pts()[2].cx1, pts()[2].cy1], [100, 40]);
    assert.ok(Math.abs(pts()[1].cx2 - 100) < 1e-9 && Math.abs(pts()[1].cy2 + 40) < 1e-9, "in turned opposite");
    C.curveDown(st, { x: 100, y: 40 }, { altKey: true }, TOL);
    C.curveMove(st, { x: 130, y: 40 }, { altKey: true });
    assert.ok(Math.abs(pts()[1].cy2 + 40) < 1e-9, "Alt: the other handle stays");
  });

test("A drags a point with its handles; a press away from the handles is not a curve press", async function () {
  const { T, C, st, pts } = await fixture();
  C.curveDown(st, { x: 100, y: 0 }, { altKey: true }, TOL);
  C.curveMove(st, { x: 140, y: 30 }, { altKey: true });
  T.penUp(st);
  T.ptDown(st, { x: 100, y: 0 }, TOL);
  T.selMove(st, { x: 110, y: 10 });
  T.penUp(st);
  assert.deepStrictEqual([pts()[1].x, pts()[1].y, pts()[1].cx2, pts()[1].cy2], [110, 10, 70, -20]);
  assert.deepStrictEqual([pts()[2].cx1, pts()[2].cy1], [150, 40]);
  assert.strictEqual(C.curveDown(st, { x: 300, y: 300 }, {}, TOL), false);
});

test("facade: A + Alt drag on a drawn corner curves it; the chosen point's handles are drawn (2 handle rings)",
  async function () {
    const { setup, ev, key } = require("./pen_kit.js");
    const { pen } = await setup();
    pen.tool("pen");
    for (const [x, y] of [[10, 10], [100, 10], [190, 10]]) {
      pen.down(ev(x, y));
      pen.up(ev(x, y));
    }
    pen.key(key("Enter"));
    pen.tool("point");
    pen.down(ev(100, 10, { altKey: true }));
    pen.move(ev(120, 30, { altKey: true }));
    pen.up(ev(120, 30, { altKey: true }));
    const path0 = pen.doc().paths[0];
    assert.strictEqual(path0.kind, "bezier");
    assert.deepStrictEqual([path0.points[2].cx1, path0.points[2].cy1], [240, 60]);
    const { drawPen } = await mod("zk_pendraw.js");
    const arcs = [];
    const g = new Proxy({}, { get: (t, n) => (n === "arc" ? (...a) => arcs.push(a) : () => null), set: () => true });
    drawPen(g, pen.state(), null, require("./pen_kit.js").CFG.pen, 1, { w: 800, h: 600 });
    assert.strictEqual(arcs.length, 3 + 2, "3 points + 2 handle ends");
  });

test("review 14:3x: a chosen point that no longer exists (erased, deleted, new picture) never throws", async function () {
  const { T, C, st } = await fixture();
  st.doc.paths[0].closed = true;
  Object.assign(st.doc.paths[0].points[0], { cx1: 1, cy1: 1, cx2: 2, cy2: 2 });
  st.doc.paths[0].kind = "bezier";
  st.selected = "p1";
  st.active = { path: "p1", index: 3 };
  assert.deepStrictEqual(C.handlesOf(st.doc.paths[0], 3), { in: null, out: null });
  assert.strictEqual(C.curveDown(st, { x: 1, y: 1 }, {}, TOL), false);
  st.grab = { x: 0, y: 0, index: 3, path: "p1", curve: "out" };
  assert.strictEqual(C.curveMove(st, { x: 5, y: 5 }, {}), false);
  const { drawPen } = await mod("zk_pendraw.js");
  const g = new Proxy({}, { get: () => () => null, set: () => true });
  st.grab = null;
  drawPen(g, st, null, { pointSizePx: 5, pointStrokePx: 1, guideWidthPx: 1, guideDashPx: 1, guideGapPx: 1 }, 1,
    { w: 10, h: 10 });
  T.ptDown(st, { x: 100, y: 0 }, TOL);
  T.penDown(Object.assign(st, { tool: "pen" }), { x: 100, y: 0 }, {}, { line: 6, point: 11, bend: 4 });
  assert.strictEqual(st.active, null, "erasing a point drops the chosen point");
});

test("Koh 14:30 (handle on one side only): P drag keeps the out handle for the next segment; A shows both sides",
  async function () {
    const T = await mod("zk_pentools.js");
    const C = await mod("zk_pencurve.js");
    const st = T.newState();
    st.tool = "pen";
    T.penDown(st, { x: 0, y: 0 }, {}, TOL);
    T.penUp(st);
    T.penDown(st, { x: 100, y: 0 }, {}, TOL);
    T.penMove(st, { x: 140, y: 30 }, TOL);
    T.penUp(st);
    T.penDown(st, { x: 200, y: 0 }, {}, TOL);
    T.penUp(st);
    T.penFinish(st);
    const path = st.doc.paths[0];
    assert.deepStrictEqual(C.handlesOf(path, 1), { in: { x: 60, y: -30 }, out: { x: 140, y: 30 } });
    const old = { kind: "bezier", closed: false, points: [{ x: 0, y: 0 }, { x: 100, y: 0, cx1: 30, cy1: 0, cx2: 60,
      cy2: -30 }, { x: 200, y: 0 }] };
    assert.deepStrictEqual(C.shownHandles(old, 1).out, { x: 140, y: 30 }, "a missing side shows mirrored");
    assert.strictEqual(C.shownHandles(old, 0).in, null, "the first point of an open line has no in side");
  });

test("review: the P out arm follows the point it was dragged from, not an index (erase in between)", async function () {
  const T = await mod("zk_pentools.js");
  const st = T.newState();
  st.tool = "pen";
  const click = function (x, y) {
    T.penDown(st, { x, y }, {}, TOL);
    T.penUp(st);
  };
  click(0, 0);
  click(100, 0);
  T.penDown(st, { x: 200, y: 0 }, {}, TOL);
  T.penMove(st, { x: 240, y: 40 }, TOL);
  T.penUp(st);
  click(100, 0);
  click(300, 100);
  const pts = st.doc.paths[0].points;
  assert.deepStrictEqual(pts.map((q) => q.x), [0, 200, 300], "the middle point was erased");
  assert.deepStrictEqual([pts[2].cx1, pts[2].cy1], [240, 40], "C's out arm still starts the next segment");
});

test("Koh voice 23:3x + 2 screenshots (the V tip went straight again): a corner point (arms not in one line) " +
  "keeps its corner: dragging one arm never swings the other; a smooth point still mirrors", async function () {
    const C = await mod("zk_pencurve.js");
    const T = await mod("zk_pentools.js");
    const st = T.newState();
    const corner = { id: "p1", kind: "bezier", closed: false, points: [{ x: 0, y: 0 },
      { x: 100, y: 0, cx1: 30, cy1: 0, cx2: 80, cy2: -40 }, { x: 200, y: 0, cx1: 120, cy1: -40, cx2: 170, cy2: 0 }] };
    st.doc.paths.push(corner);
    st.active = { path: "p1", index: 1 };
    st.grab = { curve: "in", path: "p1", index: 1 };
    C.curveMove(st, { x: 70, y: -50 }, {});
    assert.deepStrictEqual([corner.points[2].cx1, corner.points[2].cy1], [120, -40], "out arm of the V stays");
    assert.deepStrictEqual([corner.points[1].cx2, corner.points[1].cy2], [70, -50]);
    const smooth = { id: "p2", kind: "bezier", closed: false, points: [{ x: 0, y: 0 },
      { x: 100, y: 0, cx1: 30, cy1: 0, cx2: 60, cy2: -20 }, { x: 200, y: 0, cx1: 140, cy1: 20, cx2: 170, cy2: 0 }] };
    st.doc.paths.push(smooth);
    st.grab = { curve: "in", path: "p2", index: 1 };
    C.curveMove(st, { x: 60, y: 20 }, {});
    assert.deepStrictEqual([smooth.points[2].cx1, smooth.points[2].cy1].map(Math.round), [140, -20], "mirrors");
    assert.strictEqual(C.isSmooth(corner, 1), false);
    assert.strictEqual(C.isSmooth(smooth, 1), true);
  });

test("review: corner or smooth is decided once per drag, so passing through the straight line never snaps the other arm",
  async function () {
    const C = await mod("zk_pencurve.js");
    const T = await mod("zk_pentools.js");
    const st = T.newState();
    const v = { id: "p1", kind: "bezier", closed: false, points: [{ x: 0, y: 0 },
      { x: 100, y: 0, cx1: 30, cy1: 0, cx2: 80, cy2: -40 }, { x: 200, y: 0, cx1: 120, cy1: -40, cx2: 170, cy2: 0 }] };
    st.doc.paths.push(v);
    st.grab = { curve: "in", path: "p1", index: 1 };
    C.curveMove(st, { x: 80, y: 40 }, {});
    C.curveMove(st, { x: 70, y: 30 }, {});
    assert.deepStrictEqual([v.points[2].cx1, v.points[2].cy1], [120, -40]);
  });
