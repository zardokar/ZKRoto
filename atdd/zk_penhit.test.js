// Pen geometry + hit (0.4.0). Ported from Koh's canvas test (pipeline\module\canvas\atdd\js\test_cv_hit.js):
// flatten must match the python fixture within 1e-6, hits use the curve you see, points beat lines, top wins.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const FIX = path.join(__dirname, "fixtures", "pen_flatten_parity.json");

function mod(name) {
  return import(pathToFileURL(path.join(__dirname, "..", "web", "js", name)).href);
}

function curved() {
  return { id: "c1", kind: "bezier", closed: true, fill: "#6f8fbf",
    points: [{ x: 0, y: 0 }, { x: 100, y: 0, cx1: 30, cy1: -60, cx2: 70, cy2: -60 },
      { x: 100, y: 100 }, { x: 0, y: 100 }] };
}

function square(id, fill) {
  return { id, kind: "poly", closed: true, fill,
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };
}

function docOf(paths) {
  return { version: 1, seq: 0, paths };
}

test("flatten matches the python fixture (gltfio.flatten_path) within 1e-6", async function () {
  const P = await mod("zk_penpath.js");
  const fixture = JSON.parse(fs.readFileSync(FIX, "utf8"));
  for (const item of fixture.cases) {
    const got = P.flattenPath(item.path, fixture.steps);
    assert.strictEqual(got.length, item.expect.length, item.path.id);
    got.forEach(function (p, i) {
      assert.ok(Math.abs(p.x - item.expect[i][0]) <= 1e-6 && Math.abs(p.y - item.expect[i][1]) <= 1e-6, item.path.id);
    });
  }
});

test("a hit is measured on the curve you see, not on the chord between points", async function () {
  const P = await mod("zk_penpath.js");
  const flat = P.flattenPath(curved());
  const top = flat.reduce((best, p) => (p.y < best.y ? p : best), flat[0]);
  assert.ok(top.y < -20);
  assert.ok(P.pathDist(curved(), top) < 0.5);
  assert.ok(P.pathDist(curved(), { x: 50, y: 0 }) > 20);
});

test("click inside a filled body selects it (PenVec); fill none = only its line", async function () {
  const P = await mod("zk_penpath.js");
  const H = await mod("zk_penhit.js");
  assert.strictEqual(P.pointInPath(curved(), { x: 50, y: 50 }), true);
  assert.strictEqual(P.pointInPath(curved(), { x: 200, y: 50 }), false);
  assert.strictEqual(P.pointInPath(Object.assign(curved(), { closed: false }), { x: 50, y: 50 }), true,
    "Koh 15:26: an open path shows its fill (closed by a straight line, as SVG), so its fill is hit too");
  assert.strictEqual(H.hitPath(docOf([curved()]), { x: 50, y: 50 }, 2).inside, true);
  const none = docOf([Object.assign(curved(), { id: "c2", fill: "none" })]);
  assert.strictEqual(H.hitPath(none, { x: 50, y: 50 }, 2), null);
  assert.ok(H.hitPath(none, { x: 0, y: 50 }, 2));
});

test("a point beats a line and has its own wider tolerance", async function () {
  const H = await mod("zk_penhit.js");
  const doc = docOf([{ id: "q", kind: "poly", closed: true, fill: "#6f8fbf",
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] }]);
  assert.strictEqual(H.hitTest(doc, { x: 6, y: 0 }, 3, 11).pointIndex, 0);
  assert.strictEqual(H.hitTest(doc, { x: 6, y: 0 }, 3, 3).pointIndex, null);
});

test("top path wins (PenVec picked the bottom one, wrong); hidden or locked paths are skipped", async function () {
  const H = await mod("zk_penhit.js");
  const doc = docOf([square("under", "#6f8fbf"), square("over", "#e0726c")]);
  assert.strictEqual(H.hitPath(doc, { x: 50, y: 50 }, 2).pathId, "over");
  doc.paths[1].visible = false;
  assert.strictEqual(H.hitPath(doc, { x: 50, y: 50 }, 2).pathId, "under");
  doc.paths[1].visible = true;
  doc.paths[1].locked = true;
  assert.strictEqual(H.hitPath(doc, { x: 50, y: 50 }, 2).pathId, "under");
});

test("Koh 15:26 (V on the face does not transform): V on the fill of an OPEN filled line selects it", async function () {
  const T = await import(pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_pentools.js")).href);
  const st = T.newState();
  st.doc.paths.push({ id: "p1", kind: "poly", closed: false, fill: "#8a8a92", stroke: "none",
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] });
  st.tool = "select";
  T.selDown(st, { x: 80, y: 30 }, { line: 6, point: 11, bend: 4 });
  assert.strictEqual(st.selected, "p1");
});
