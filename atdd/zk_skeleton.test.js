// Unit tests for web/js/zk_skeleton.js (drawing OpenPose 18 / MediaPipe 33 on a 2D context; a fake context records calls).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_skeleton.js")).href;
const K = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "constants", "zkroto.json"), "utf8"));
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "config", "zkroto.json"), "utf8"));

function load() {
  return import(MODULE);
}

function fakeContext() {
  const calls = [];
  const g = { calls };
  for (const name of ["beginPath", "moveTo", "lineTo", "stroke", "fill", "arc", "ellipse", "fillRect", "fillText", "save", "restore"]) {
    g[name] = function (...args) {
      calls.push({ name, args, fillStyle: g.fillStyle, strokeStyle: g.strokeStyle, lineWidth: g.lineWidth });
    };
  }
  return g;
}

function op18(hidden) {
  const out = [];
  for (let j = 0; j < 18; j += 1) {
    out.push(hidden.includes(j) ? [0, 0, 0] : [100 + j * 10, 200 + j * 5, 1]);
  }
  return out;
}

function named(g, name) {
  return g.calls.filter(function (c) {
    return c.name === name;
  });
}

test("OpenPose: one ellipse per limb with both ends visible, colour x 0.6; one full-colour joint per visible joint", async function () {
  const s = await load();
  const g = fakeContext();
  s.drawOpenPose(g, op18([4, 17]), K.colors.openpose, [832, 1216], CFG.openpose);
  const ellipses = named(g, "ellipse");
  assert.strictEqual(ellipses.length, 15);
  assert.strictEqual(ellipses[0].fillStyle, "rgb(153, 0, 0)");
  const arcs = named(g, "arc");
  assert.strictEqual(arcs.length, 16);
  assert.strictEqual(arcs[0].fillStyle, "rgb(255, 0, 0)");
});

test("OpenPose stick width and joint radius: 4 px at a 512 px short side, scaled", async function () {
  const s = await load();
  const g = fakeContext();
  s.drawOpenPose(g, op18([]), K.colors.openpose, [832, 1216], CFG.openpose);
  const scale = 832 / 512;
  assert.strictEqual(named(g, "ellipse")[0].args[3], 4 * scale);
  assert.strictEqual(named(g, "arc")[0].args[2], 4 * scale);
});

test("MediaPipe: lines only between joints at or over the threshold, colour per connection", async function () {
  const s = await load();
  const g = fakeContext();
  const mp = [];
  for (let i = 0; i < 33; i += 1) {
    mp.push([i, i, i === 13 ? 0.1 : 1]);
  }
  s.drawMediaPipe(g, mp, K.mpConnections, function () {
    return "#123456";
  }, { threshold: 0.3, lineWidth: 2, radius: 3 });
  assert.strictEqual(named(g, "stroke").length, 35 - 2);
  assert.strictEqual(named(g, "arc").length, 32);
  assert.strictEqual(named(g, "stroke")[0].strokeStyle, "#123456");
});

test("sheet colours: one colour per side from constants mpSides (eyes 1-3 left, 4-6 right); mixed = centre", async function () {
  const s = await load();
  const c = K.colors.sheet;
  const sides = K.mpSides;
  assert.strictEqual(sides.length, 33);
  const names = K.mpNames;
  names.forEach(function (name, i) {
    const want = name.includes("left") ? c.left : name.includes("right") ? c.right : c.center;
    assert.strictEqual(s.sideColor(i, c, sides), want, `${i} ${name}`);
  });
  assert.strictEqual(s.connectionColor(11, 13, c, sides), c.left);
  assert.strictEqual(s.connectionColor(11, 12, c, sides), c.center);
});

test("OpenPose face: one white point per shown face point (annotator style), radius 3 px at a 512 px short side", async function () {
  const s = await load();
  const g = fakeContext();
  const pts = [];
  for (let i = 0; i < 70; i += 1) {
    pts.push(i === 5 ? [0, 0, 0] : [i, i, 1]);
  }
  s.drawOpenFace(g, pts, K.colors.face, [832, 1216], CFG.openpose);
  const arcs = named(g, "arc");
  assert.strictEqual(arcs.length, 69);
  assert.strictEqual(arcs[0].fillStyle, "rgb(255, 255, 255)");
  assert.strictEqual(arcs[0].args[2], 3 * 832 / 512);
});
