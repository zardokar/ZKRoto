// Pen drawing (web/js/zk_pendraw.js): what Koh's canvas overlay shows (cv_overlay.js): the paths, the chosen
// path's points white with a dark ring, a dashed guide from the last point to the mouse while drawing; sizes are
// screen pixels divided by the zoom, colours are not.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const WEB = path.join(__dirname, "..", "web");
const CFG = JSON.parse(fs.readFileSync(path.join(WEB, "config", "zkroto.json"), "utf8"));

function mod(name) {
  return import(pathToFileURL(path.join(WEB, "js", name)).href);
}

function recorder() {
  const calls = [];
  const g = { set: {} };
  for (const name of ["clearRect", "beginPath", "moveTo", "lineTo", "bezierCurveTo", "closePath", "stroke", "fill", "arc",
    "setLineDash"]) {
    g[name] = function (...args) {
      calls.push({ name, args });
    };
  }
  return { g: new Proxy(g, { set: function (t, k, v) {
    calls.push({ name: "set:" + String(k), args: [v] });
    t[k] = v;
    return true;
  } }), calls };
}

async function oneLine() {
  const T = await mod("zk_pentools.js");
  const st = T.newState();
  st.tool = "pen";
  const tol = { line: 6, point: 11, bend: 4 };
  T.penDown(st, { x: 10, y: 10 }, {}, tol);
  T.penUp(st);
  T.penDown(st, { x: 50, y: 10 }, {}, tol);
  T.penUp(st);
  return st;
}

test("while drawing: path stroked, its 2 points as rings, a dashed guide to the mouse, dash reset after", async function () {
  const { drawPen } = await mod("zk_pendraw.js");
  const st = await oneLine();
  const rec = recorder();
  drawPen(rec.g, st, { x: 90, y: 40 }, CFG.pen, 2, { w: 800, h: 600 });
  const names = rec.calls.map(function (c) {
    return c.name;
  });
  assert.strictEqual(names[0], "clearRect");
  assert.strictEqual(names.filter(function (n) {
    return n === "arc";
  }).length, 2);
  const dash = rec.calls.filter(function (c) {
    return c.name === "setLineDash";
  });
  assert.deepStrictEqual(dash[0].args[0], [CFG.pen.guideDashPx * 2, CFG.pen.guideGapPx * 2]);
  assert.deepStrictEqual(dash[dash.length - 1].args[0], []);
  const to = rec.calls.filter(function (c) {
    return c.name === "lineTo";
  });
  assert.deepStrictEqual(to[to.length - 1].args, [90, 40], "guide ends at the mouse");
  const arc = rec.calls.find(function (c) {
    return c.name === "arc";
  });
  assert.strictEqual(arc.args[2], CFG.pen.pointSizePx * 2, "point radius in screen px x zoom");
});

test("no tool on: paths only, no points, no guide", async function () {
  const { drawPen } = await mod("zk_pendraw.js");
  const T = await mod("zk_pentools.js");
  const st = await oneLine();
  T.penFinish(st);
  st.tool = null;
  const rec = recorder();
  drawPen(rec.g, st, { x: 90, y: 40 }, CFG.pen, 1, { w: 800, h: 600 });
  const names = rec.calls.map(function (c) {
    return c.name;
  });
  assert.strictEqual(names.includes("arc"), false);
  assert.strictEqual(names.includes("setLineDash"), false);
  assert.strictEqual(names.filter(function (n) {
    return n === "stroke";
  }).length, 1);
});

test("a hidden path is not drawn; a closed filled path is filled and stroked", async function () {
  const { drawPen } = await mod("zk_pendraw.js");
  const D = await mod("zk_pendoc.js");
  const T = await mod("zk_pentools.js");
  const st = T.newState();
  st.tool = null;
  D.addPath(st.doc, { closed: true, fill: "#123456", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] });
  D.addPath(st.doc, { visible: false, points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] });
  const rec = recorder();
  drawPen(rec.g, st, null, CFG.pen, 1, { w: 100, h: 100 });
  const names = rec.calls.map(function (c) {
    return c.name;
  });
  assert.strictEqual(names.filter(function (n) {
    return n === "fill";
  }).length, 1);
  assert.strictEqual(names.filter(function (n) {
    return n === "stroke";
  }).length, 1);
});

test("fill first: an open shape with a fill is filled like SVG does (closed for the fill only), opacity apart",
  async function () {
    const { drawPen } = await mod("zk_pendraw.js");
    const st = await oneLine();
    const p = st.doc.paths[0];
    p.fill = "#8a8a92";
    p.fill_opacity = 0.5;
    p.stroke_opacity = 0.25;
    st.pen = null;
    const rec = recorder();
    drawPen(rec.g, st, null, CFG.pen, 1, { w: 800, h: 600 });
    const i = rec.calls.findIndex((c) => c.name === "fill");
    assert.ok(i > 0, "filled although open");
    const before = rec.calls.slice(0, i);
    assert.deepStrictEqual(before.filter((c) => c.name === "set:fillStyle").pop().args, ["#8a8a92"]);
    assert.deepStrictEqual(before.filter((c) => c.name === "set:globalAlpha").pop().args, [0.5]);
    const j = rec.calls.findIndex((c, k) => k > i && c.name === "stroke");
    const mid = rec.calls.slice(i, j);
    assert.deepStrictEqual(mid.filter((c) => c.name === "set:globalAlpha").pop().args, [0.25]);
    assert.strictEqual(rec.calls.filter((c) => c.name === "closePath").length, 0, "the line itself stays open");
  });

test("V on a chosen shape: the transform box with 8 handles + the rotate handle (9 rings), no vertex points; " +
  "A shows the vertex points instead (canvas test_cv_transform_flow: 9 then 3)", async function () {
  const { drawPen } = await mod("zk_pendraw.js");
  const st = await oneLine();
  T_finish(st);
  st.tool = "select";
  let rec = recorder();
  drawPen(rec.g, st, null, CFG.pen, 1, { w: 800, h: 600 });
  assert.strictEqual(rec.calls.filter((c) => c.name === "arc").length, 9);
  st.tool = "point";
  rec = recorder();
  drawPen(rec.g, st, null, CFG.pen, 1, { w: 800, h: 600 });
  assert.strictEqual(rec.calls.filter((c) => c.name === "arc").length, 2);
});

function T_finish(st) {
  st.pen = null;
  st.selected = st.doc.paths[0].id;
}

test("the line being drawn shows as a guide-colour sketch even with stroke None (canvas rule 23, Koh 14:21)",
  async function () {
    const { drawPen } = await mod("zk_pendraw.js");
    const st = await oneLine();
    st.doc.paths[0].stroke = "none";
    st.doc.paths[0].fill = "none";
    const rec = recorder();
    drawPen(rec.g, st, null, CFG.pen, 1, { w: 800, h: 600 });
    const strokes = rec.calls.filter((c) => c.name === "set:strokeStyle").map((c) => c.args[0]);
    assert.ok(strokes.includes(CFG.pen.guideColor), "sketch in the guide colour");
  });

test("Koh 14:31 (curves look angular): a bezier segment is drawn as a true cubic, not 16 straight pieces",
  async function () {
    const R = await mod("zk_pendraw.js");
    const doc = { paths: [{ id: "p1", kind: "bezier", closed: true, fill: "#888888", stroke: "none", points: [
      { x: 0, y: 0, cx1: 0, cy1: -40, cx2: 60, cy2: -40 }, { x: 100, y: 0 }, { x: 50, y: 80, cx1: 120, cy1: 40,
        cx2: 90, cy2: 90 }] }] };
    const r = recorder();
    R.drawPen(r.g, { doc, tool: "select", selected: null }, null, CFG.pen, 1, { w: 100, h: 100 });
    const curves = r.calls.filter((c) => c.name === "bezierCurveTo").map((c) => c.args);
    assert.deepStrictEqual(curves, [[120, 40, 90, 90, 50, 80], [0, -40, 60, -40, 0, 0]]);
    assert.strictEqual(r.calls.filter((c) => c.name === "lineTo").length, 1, "only the plain segment is a line");
  });

test("Koh 15:33 (arms blend with the fill): each A arm is a white line over a wider dark line, like the points",
  async function () {
    const R = await mod("zk_pendraw.js");
    const doc = { paths: [{ id: "p1", kind: "bezier", closed: false, fill: "#8a8a92", stroke: "none", points: [
      { x: 0, y: 0 }, { x: 100, y: 0, cx1: 30, cy1: 0, cx2: 60, cy2: -30 }, { x: 200, y: 0 }] }] };
    const r = recorder();
    R.drawPen(r.g, { doc, tool: "point", selected: "p1", active: { path: "p1", index: 1 } }, null, CFG.pen, 1,
      { w: 300, h: 300 });
    const strokes = [];
    const style = {};
    r.calls.forEach((c) => (c.name.startsWith("set:") ? (style[c.name.slice(4)] = c.args[0]) : c.name === "lineTo" &&
      strokes.push({ to: c.args, colour: style.strokeStyle, width: style.lineWidth })));
    const arms = strokes.filter((s) => s.to[0] === 60 || s.to[0] === 140);
    assert.strictEqual(arms.length, 4, "two arms (in + mirrored out), two layers each");
    for (const pair of [arms.slice(0, 2), arms.slice(2)]) {
      assert.strictEqual(pair[0].colour, CFG.pen.pointStroke);
      assert.strictEqual(pair[1].colour, CFG.pen.pointFill);
      assert.ok(pair[0].width > pair[1].width, "the dark line is wider, so it shows around the white one");
    }
  });
