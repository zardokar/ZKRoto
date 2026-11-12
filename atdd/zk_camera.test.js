// Unit tests for web/js/zk_camera.js (world -> Y up, floor, target, eye, look-at + roll, pinhole projection).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_camera.js")).href;
const EPS = 1e-9;
const SIZE = [832, 1216];

function load() {
  return import(MODULE);
}

function near(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= (eps || EPS), `${msg || ""} ${a} != ${b}`);
}

function nearVec(a, b, eps, msg) {
  a.forEach(function (v, i) {
    near(v, b[i], eps, `${msg || ""}[${i}]`);
  });
}

// MediaPipe world style (y down, z smaller = nearer the source camera): 33 points at the hips, a few set.
function world() {
  const w = [];
  for (let i = 0; i < 33; i += 1) {
    w.push([0, 0, 0]);
  }
  w[7] = [0.08, -0.6, 0.02];
  w[8] = [-0.08, -0.6, 0.0];
  w[11] = [0.15, -0.45, 0.0];
  w[12] = [-0.15, -0.45, 0.02];
  w[23] = [0.1, 0.0, 0.0];
  w[24] = [-0.1, 0.0, 0.0];
  w[27] = [0.1, 0.85, 0.05];
  w[28] = [-0.1, 0.8, 0.05];
  return w;
}

test("toYUp: X = x, Y = -y, Z = -z", async function () {
  const c = await load();
  assert.deepStrictEqual(c.toYUp([[1, 2, 3], [-0.5, 0, -1]]), [[1, -2, -3], [-0.5, -0, 1]]);
});

test("floorY = lowest Y of the joints over the threshold; hidden joints do not count", async function () {
  const c = await load();
  const W = c.toYUp(world());
  const vis = new Array(33).fill(1);
  near(c.floorY(W, vis, 0.3), -0.85);
  vis[27] = 0.1;
  near(c.floorY(W, vis, 0.3), -0.8);
});

test("targetPoint: hips = middle of 23/24, chest = middle of 11/12, head = middle of 7/8", async function () {
  const c = await load();
  const W = c.toYUp(world());
  nearVec(c.targetPoint(W, "hips"), [0, 0, 0]);
  nearVec(c.targetPoint(W, "chest"), [0, 0.45, -0.01]);
  nearVec(c.targetPoint(W, "head"), [0, 0.6, -0.01]);
});

test("eyePoint for yaw 0 / 90 / 180 / -90 (yaw 0 = the source camera's side, 90 = the person's left)", async function () {
  const c = await load();
  const T = [0.2, 0.45, -0.1];
  const cam = { yaw: 0, eyeHeight: 1.55, distance: 1.2 };
  const floor = -0.85;
  nearVec(c.eyePoint(cam, T, floor), [0.2, 0.7, 1.1], 1e-12, "yaw 0");
  nearVec(c.eyePoint({ ...cam, yaw: 90 }, T, floor), [1.4, 0.7, -0.1], 1e-12, "yaw 90");
  nearVec(c.eyePoint({ ...cam, yaw: 180 }, T, floor), [0.2, 0.7, -1.3], 1e-12, "yaw 180");
  nearVec(c.eyePoint({ ...cam, yaw: -90 }, T, floor), [-1.0, 0.7, -0.1], 1e-12, "yaw -90");
});

test("viewBasis yaw 0 at target height: right = +X, up = +Y, forward = -Z", async function () {
  const c = await load();
  const b = c.viewBasis([0, 0, 2], [0, 0, 0], 0, 0);
  nearVec(b.right, [1, 0, 0]);
  nearVec(b.up, [0, 1, 0]);
  nearVec(b.fwd, [0, 0, -1]);
});

test("viewBasis straight down: no NaN, right falls back to the yaw direction", async function () {
  const c = await load();
  const b = c.viewBasis([0, 3, 0], [0, 0, 0], 90, 0);
  for (const v of [b.right, b.up, b.fwd]) {
    for (const x of v) {
      assert.ok(Number.isFinite(x), "finite");
    }
  }
  nearVec(b.fwd, [0, -1, 0]);
  nearVec(b.right, [0, 0, -1]);
});

test("viewBasis roll 90 turns right into up", async function () {
  const c = await load();
  const b = c.viewBasis([0, 0, 2], [0, 0, 0], 0, 90);
  nearVec(b.right, [0, 1, 0], 1e-12);
  nearVec(b.up, [-1, 0, 0], 1e-12);
});

test("project: the target lands in the image centre, +X to the right at yaw 0, f from the vertical FOV", async function () {
  const c = await load();
  const eye = [0, 0, 2];
  const b = c.viewBasis(eye, [0, 0, 0], 0, 0);
  const p = c.project([[0, 0, 0], [0.5, 0, 0], [0, 0.5, 0]], eye, b, 60, SIZE, 0.05);
  const f = 608 / Math.tan(Math.PI / 6);
  nearVec(p[0], [416, 608, 2], 1e-9);
  nearVec(p[1], [416 + f * 0.25, 608, 2], 1e-9);
  nearVec(p[2], [416, 608 - f * 0.25, 2], 1e-9);
});

test("project: a joint behind the eye or nearer than 5 cm is hidden (null)", async function () {
  const c = await load();
  const eye = [0, 0, 2];
  const b = c.viewBasis(eye, [0, 0, 0], 0, 0);
  const p = c.project([[0, 0, 3], [0, 0, 1.96], [0, 0, 1.94]], eye, b, 60, SIZE, 0.05);
  assert.strictEqual(p[0], null);
  assert.strictEqual(p[1], null);
  assert.notStrictEqual(p[2], null);
});

test("yaw 180 mirrors left and right: the person's left shoulder changes image side", async function () {
  const c = await load();
  const W = c.toYUp(world());
  const T = c.targetPoint(W, "chest");
  const cam = { yaw: 0, eyeHeight: 1.3, distance: 1.2, fov: 60, roll: 0 };
  const sides = [0, 180].map(function (yaw) {
    const eye = c.eyePoint({ ...cam, yaw }, T, -0.85);
    const p = c.project(W, eye, c.viewBasis(eye, T, yaw, 0), 60, SIZE, 0.05);
    return p[11][0] - p[12][0];
  });
  assert.ok(sides[0] > 0, "yaw 0: left shoulder on the image right");
  assert.ok(sides[1] < 0, "yaw 180: left shoulder on the image left");
});
