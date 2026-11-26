// Pen tools (0.4.0): P pen, V move path, A move point - the behaviour of Koh's canvas module
// (cv_tool_pen.js, cv_tool_select.js) and PenVec 2012 (click the first point to close, PointIsInPolygon).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const TOL = { line: 6, point: 11, bend: 4 };

function mod(name) {
  return import(pathToFileURL(path.join(__dirname, "..", "web", "js", name)).href);
}

async function drawn(points) {
  const T = await mod("zk_pentools.js");
  const st = T.newState();
  st.tool = "pen";
  for (const [x, y] of points) {
    T.penDown(st, { x, y }, {}, TOL);
    T.penUp(st);
  }
  return { T, st };
}

test("keys are the canvas module's (PenVec): V move path, A move point, P pen, Z zoom, I eyedrop", async function () {
  const T = await mod("zk_pentools.js");
  assert.deepStrictEqual(T.TOOLS, { select: "KeyV", point: "KeyA", pen: "KeyP", zoom: "KeyZ", eyedrop: "KeyI" });
});

test("pen: clicks add points; clicking the first point (3+ points) closes the path and ends it", async function () {
  const { T, st } = await drawn([[0, 0], [100, 0], [100, 100]]);
  assert.strictEqual(st.doc.paths[0].points.length, 3);
  T.penDown(st, { x: 1, y: 1 }, {}, TOL);
  assert.strictEqual(st.doc.paths[0].closed, true);
  assert.strictEqual(st.pen, null);
});

test("pen: Enter keeps an open line; a single point is dropped; Esc drops the whole line", async function () {
  const a = await drawn([[0, 0], [50, 0]]);
  a.T.penFinish(a.st);
  assert.strictEqual(a.st.doc.paths.length, 1);
  assert.strictEqual(a.st.doc.paths[0].closed, false);
  const b = await drawn([[0, 0]]);
  b.T.penFinish(b.st);
  assert.strictEqual(b.st.doc.paths.length, 0);
  const c = await drawn([[0, 0], [50, 0], [50, 50]]);
  c.T.penCancel(c.st);
  assert.strictEqual(c.st.doc.paths.length, 0);
});

test("pen: drag while placing pulls mirrored Bezier handles (past 4 px only)", async function () {
  const { T, st } = await drawn([[0, 0]]);
  T.penDown(st, { x: 100, y: 0 }, {}, TOL);
  assert.strictEqual(T.penMove(st, { x: 102, y: 0 }, TOL), false);
  assert.strictEqual(T.penMove(st, { x: 100, y: 30 }, TOL), true);
  const p = st.doc.paths[0].points[1];
  assert.strictEqual(st.doc.paths[0].kind, "bezier");
  assert.deepStrictEqual([p.cx1, p.cy1, p.cx2, p.cy2], [35, 0, 100, -30]);
});

test("pen on its own path: click a line inserts a point, click a point removes it", async function () {
  const { T, st } = await drawn([[0, 0], [100, 0], [100, 100]]);
  T.penDown(st, { x: 50, y: 1 }, {}, TOL);
  assert.deepStrictEqual(st.doc.paths[0].points[1], { x: 50, y: 0 }, "on the line (14:39: the shape keeps)");
  T.penDown(st, { x: 50, y: 1 }, {}, TOL);
  assert.strictEqual(st.doc.paths[0].points.length, 3);
});

test("pen: Ctrl+Z while drawing steps back one point, Ctrl+Y puts it back", async function () {
  const { T, st } = await drawn([[0, 0], [100, 0], [100, 100]]);
  T.penStep(st, true);
  assert.strictEqual(st.doc.paths[0].points.length, 2);
  T.penStep(st, false);
  assert.strictEqual(st.doc.paths[0].points.length, 3);
});

test("V moves the whole path (inside the filled body too); A moves one point", async function () {
  const { T, st } = await drawn([[0, 0], [100, 0], [100, 100]]);
  T.penDown(st, { x: 0, y: 0 }, {}, TOL);
  st.doc.paths[0].fill = "#336699";
  st.tool = "select";
  T.selDown(st, { x: 80, y: 40 }, TOL);
  T.selMove(st, { x: 90, y: 50 });
  assert.deepStrictEqual(st.doc.paths[0].points[0], { x: 10, y: 10 });
  T.penUp(st);
  st.tool = "point";
  T.ptDown(st, { x: 110, y: 10 }, TOL);
  T.selMove(st, { x: 120, y: 5 });
  assert.deepStrictEqual(st.doc.paths[0].points[1], { x: 120, y: 5 });
  assert.deepStrictEqual(st.doc.paths[0].points[0], { x: 10, y: 10 });
});

test("svg: tag like the canvas module; an open path with taper becomes a pointed filled body", async function () {
  const S = await mod("zk_pensvg.js");
  const doc = { version: 1, seq: 2, paths: [
    { id: "p1", kind: "poly", closed: true, fill: "#336699", stroke: "#000", stroke_width: 2,
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
    { id: "p2", kind: "poly", closed: false, fill: "none", stroke: "#62120d", stroke_width: 6, taper: [0.2, 0.45],
      points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] }] };
  const svg = S.toSvg(doc, 200, 100);
  assert.ok(svg.includes('d="M0 0 L10 0 L10 10 L0 0 Z" fill="#336699" stroke="#000" stroke-width="2"'));
  const body = svg.split("\n").find((l) => l.includes('id="p_p2"'));
  assert.ok(body.includes('fill="#62120d"') && !body.includes("stroke="));
  const ys = body.match(/M[^"]+/)[0].split(/[ML]/).filter(Boolean).map((q) => Number(q.trim().split(" ")[1]));
  assert.strictEqual(Math.min(...ys), 47);
  assert.ok(ys[0] === 50 && ys[50] === 50, "both ends come to a point");
});

test("svg opacity (canvas cv_render.js cvOpAttr): written only when not full, so untouched files stay the same",
  async function () {
    const S = await mod("zk_pensvg.js");
    const base = { kind: "poly", closed: true, fill: "#336699", stroke: "#000000", stroke_width: 2,
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] };
    const half = S.pathTag(Object.assign({ id: "a", fill_opacity: 0.5, stroke_opacity: 0.25 }, base));
    assert.ok(half.includes('fill="#336699" fill-opacity="0.5" stroke="#000000" stroke-opacity="0.25" stroke-width'));
    const full = S.pathTag(Object.assign({ id: "b", fill_opacity: 1 }, base));
    assert.ok(!full.includes("opacity"));
    const body = S.pathTag({ id: "c", kind: "poly", closed: false, stroke: "#62120d", stroke_width: 6,
      stroke_opacity: 0.4, taper: [0.2, 0.45], points: [{ x: 0, y: 50 }, { x: 100, y: 50 }] });
    assert.ok(body.includes('fill="#62120d" fill-opacity="0.4"'), "a tapered body is the stroke, so its opacity");
  });

test("A drag keeps the press offset: the point moves by the mouse travel, it does not jump under the cursor",
  async function () {
    const { T, st } = await drawn([[0, 0], [100, 0], [100, 100]]);
    T.penFinish(st);
    st.tool = "point";
    T.ptDown(st, { x: 106, y: 4 }, TOL);
    T.selMove(st, { x: 116, y: 4 });
    assert.deepStrictEqual(st.doc.paths[0].points[1], { x: 110, y: 0 });
  });

test("Koh 14:40: an open line finished with fill and stroke both None is deleted (nothing to see = no shape)",
  async function () {
    const T = await mod("zk_pentools.js");
    for (const [style, left] of [[{ fill: "none", stroke: "none" }, 0], [{ fill: "#888888", stroke: "none" }, 1],
      [{ fill: "none", stroke: "#000000" }, 1]]) {
      const st = T.newState();
      st.tool = "pen";
      for (const [x, y] of [[0, 0], [100, 0], [100, 100]]) {
        T.penDown(st, { x, y }, {}, TOL, style);
        T.penUp(st);
      }
      T.penFinish(st);
      assert.strictEqual(st.doc.paths.length, left, JSON.stringify(style));
      assert.strictEqual(st.selected, left ? st.doc.paths[0].id : null);
    }
  });
