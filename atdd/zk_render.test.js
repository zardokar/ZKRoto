// web/js/zk_render.js: the sheet draws each frame's own points inside its own tile, labelled with its frame number;
// the full OpenPose PNG (choice A) is the body PNG plus the face points on one canvas.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_render.js")).href;
const K = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "constants", "zkroto.json"), "utf8"));
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "config", "zkroto.json"), "utf8"));

function recorder() {
  const calls = [];
  const g = {};
  for (const name of ["beginPath", "moveTo", "lineTo", "stroke", "fill", "arc", "ellipse", "fillRect", "fillText"]) {
    g[name] = function (...args) {
      calls.push({ name, args });
    };
  }
  return { g, calls };
}

// Frame n: every point at (100 + n, 200 + n) in a 832 x 1216 camera, visible.
function frameData(n) {
  const points = [];
  for (let i = 0; i < 33; i += 1) {
    points.push([100 + n, 200 + n, 1]);
  }
  return { frame: n, camera: "src", width: 832, height: 1216, points, world: [] };
}

test("sheet: frames in order, each tile's points come from that frame and sit inside that tile", async function () {
  const { createRender } = await import(MODULE);
  const rec = recorder();
  const render = createRender(K, CFG, function (w, h) {
    return { width: w, height: h, getContext: function () {
      return rec.g;
    } };
  });
  render.renderSheet([frameData(30), frameData(10), frameData(20)], 6);
  const labels = rec.calls.filter(function (c) {
    return c.name === "fillText";
  }).map(function (c) {
    return c.args[0];
  });
  assert.deepStrictEqual(labels, ["f000010", "f000020", "f000030"]);
  const s = CFG.sheet.tileWidth / 832;
  const arcs = rec.calls.filter(function (c) {
    return c.name === "arc";
  });
  assert.strictEqual(arcs.length, 99);
  [10, 20, 30].forEach(function (n, t) {
    const x = CFG.sheet.gap + t * (CFG.sheet.tileWidth + CFG.sheet.gap) + (100 + n) * s;
    assert.ok(Math.abs(arcs[t * 33].args[0] - x) < 1e-9, `tile ${t} frame ${n}`);
  });
});

// OpenPose 18 with every joint at (100 + 10 j, 300 + 20 j); face 70 every point at (400 + j, 200 + j); all visible.
function bodyAndFace() {
  const op = [];
  for (let j = 0; j < 18; j += 1) {
    op.push([100 + 10 * j, 300 + 20 * j, 1]);
  }
  const face = [];
  for (let j = 0; j < 70; j += 1) {
    face.push([400 + j, 200 + j, 1]);
  }
  return { op, face };
}

async function drawCalls(fn) {
  const { createRender } = await import(MODULE);
  const rec = recorder();
  const render = createRender(K, CFG, function (w, h) {
    return { width: w, height: h, getContext: function () {
      return rec.g;
    } };
  });
  fn(render);
  return rec.calls;
}

test("full (choice A): one canvas = the body PNG's drawing, then the 70 face points on top, nothing else", async function () {
  const { op, face } = bodyAndFace();
  const size = [1024, 1536];
  const body = await drawCalls(function (r) {
    r.renderOpenPose(op, size);
  });
  const full = await drawCalls(function (r) {
    r.renderFull(op, face, size);
  });
  assert.deepStrictEqual(full.slice(0, body.length), body, "same body drawing as openpose/");
  const rest = full.slice(body.length).filter(function (c) {
    return c.name === "arc";
  });
  assert.strictEqual(rest.length, 70);
  assert.strictEqual(full.slice(body.length).some(function (c) {
    return c.name === "fillRect" || c.name === "ellipse";
  }), false, "no second background, no limbs over the face");
  const radius = CFG.openpose.faceRadius * (1024 / CFG.openpose.refShortSide);
  rest.forEach(function (c, j) {
    assert.deepStrictEqual(c.args.slice(0, 3), [400 + j, 200 + j, radius], `face point ${j}`);
  });
});

test("full without a face: exactly the body PNG's drawing", async function () {
  const { op } = bodyAndFace();
  const body = await drawCalls(function (r) {
    r.renderOpenPose(op, [832, 1216]);
  });
  const full = await drawCalls(function (r) {
    r.renderFull(op, null, [832, 1216]);
  });
  assert.deepStrictEqual(full, body);
});
