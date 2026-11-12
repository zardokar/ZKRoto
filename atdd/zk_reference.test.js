// Reference check (user rule 2026-11-09: values AND the reference pictures, front AND side, every time).
// ZKRoto POV of the FRA-007 front.png pose vs MediaPipe on front.png / side.png themselves, fitted the same way.
// Camera: eye at chest height, 3 m; yaw 0 (front) and 90 (side.png shows the person's left). Pictures: draw_fs.py.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const JS = path.join(__dirname, "..", "web", "js");
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "config", "zkroto.json"), "utf8"));
const FRONT = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "front_pose_face.json"), "utf8"));
const SIDE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "side_pose.json"), "utf8"));
const SIZE = [1024, 1536];
const HEAD = [0, 14, 15, 16, 17];

function load(name) {
  return import(pathToFileURL(path.join(JS, name)).href);
}

function dist(a, b, idx) {
  const d = [];
  (idx || a.map(function (_p, i) {
    return i;
  })).forEach(function (i) {
    if (a[i][2] > 0 && b[i][2] > 0) {
      d.push(Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
    }
  });
  return { mean: d.reduce(function (s, x) {
    return s + x;
  }, 0) / d.length, max: Math.max(...d), n: d.length };
}

async function views(options) {
  const s = await load("zk_povstate.js");
  const v = await load("zk_pov.js");
  const fr = await load("zk_framing.js");
  const W = FRONT.person.world;
  const chest = -(W[11][1] + W[12][1]) / 2 - Math.min(...W.map(function (p) {
    return -p[1];
  }));
  const out = {};
  for (const [name, ref, yaw] of [["front", FRONT, 0], ["side", SIDE, 90]]) {
    const real = v.srcPoints(ref.person, ref.width, ref.height, 0.3);
    const tr = fr.fitTransform(real.op, SIZE, CFG.pov.margins);
    let pov = s.setCamera(s.povDefaults(CFG), { eyeHeight: chest, distance: 3, yaw }, CFG);
    pov = s.setOptions(pov, options || {}, CFG);
    const r = v.povPoints(FRONT.person, pov, SIZE, CFG, { width: FRONT.width, height: FRONT.height });
    out[name] = { real, tr, r, fit: fr.applyTransform(real.op, tr), fitFace: real.face ? fr.applyTransform(real.face.op, tr) : null };
  }
  return out;
}

test("front: body within 2 % of the height, face within 8 % of the face width (mean)", async function () {
  const { front } = await views();
  const body = dist(front.r.op, front.fit);
  assert.ok(body.mean / SIZE[1] < 0.02, JSON.stringify(body));
  const w = Math.hypot(front.fitFace[0][0] - front.fitFace[16][0], front.fitFace[0][1] - front.fitFace[16][1]);
  const face = dist(front.r.face.op, front.fitFace);
  assert.strictEqual(face.n, 70);
  assert.ok(face.mean / w < 0.08 && face.max / w < 0.12, JSON.stringify({ face, w }));
});

test("side: body within 3 % of the height, head (nose, eyes, ears) within 1.5 % - the side view stands upright", async function () {
  const { side } = await views();
  const body = dist(side.r.op, side.fit);
  const head = dist(side.r.op, side.fit, HEAD);
  assert.ok(body.mean / SIZE[1] < 0.03, JSON.stringify(body));
  assert.ok(head.mean / SIZE[1] < 0.015, JSON.stringify(head));
  assert.ok(side.r.face.op.some(function (p) {
    return p[2] > 0;
  }), "near half of the face shown");
});

test("guard: MediaPipe's raw depth (x 1) fails the side check - the lean of 0.2.1 / 0.2.2", async function () {
  const { side } = await views({ depth: 1 });
  const head = dist(side.r.op, side.fit, HEAD);
  assert.ok(head.mean / SIZE[1] > 0.05, JSON.stringify(head));
});

test("x / y from the image: front closer to the drawing than world, no joint more than 1 grid cell off (trials T06 vs T11)", async function () {
  const { compareGrid } = require(path.join(__dirname, "..", "dev", "zk_grid.js"));
  const grid = { cols: 20, rows: 30 };
  const img = (await views({ xy: "image" })).front;
  const wld = (await views({ xy: "world" })).front;
  const a = compareGrid(img.fit, img.r.op, img.fit.map(String), SIZE, grid).summary;
  const b = compareGrid(wld.fit, wld.r.op, wld.fit.map(String), SIZE, grid).summary;
  assert.strictEqual(a.far, 0, JSON.stringify(a));
  assert.ok(a.same > b.same, JSON.stringify({ image: a, world: b }));
});
