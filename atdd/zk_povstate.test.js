// Unit tests for web/js/zk_povstate.js (POV settings: defaults, clamps, presets, orbit, views, options).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_povstate.js")).href;
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "config", "zkroto.json"), "utf8"));

function load() {
  return import(MODULE);
}

test("defaults from config: yaw 0, eye 1.55 m, distance 1.20 m, FOV 60, roll 0, chest, portrait, fit, 10/9/5 %, 0.30", async function () {
  const s = await load();
  const p = s.povDefaults(CFG);
  assert.deepStrictEqual(p.camera, { yaw: 0, eyeHeight: 1.55, distance: 1.2, fov: 60, roll: 0, lookAt: "chest" });
  assert.strictEqual(p.outMode, "portrait");
  assert.strictEqual(p.framing, "fit");
  assert.deepStrictEqual(p.margins, { top: 0.1, bottom: 0.09, sides: 0.05 });
  assert.strictEqual(p.threshold, 0.3);
  assert.strictEqual(p.depth, 0.25);
  assert.strictEqual(p.xy, "world");
  assert.strictEqual(s.setOptions(p, { xy: "image" }, CFG).xy, "image");
  assert.strictEqual(s.setOptions(p, { xy: "nope" }, CFG).xy, "world");
  assert.deepStrictEqual(p.layers, { op: true, mp: true, face: true });
  assert.strictEqual(p.view, "source");
  assert.strictEqual(p.person, 0);
  assert.strictEqual(p.srcCamera, true);
  assert.deepStrictEqual(p.names, { shot: "", character: "" });
});

test("setCamera clamps to the ranges, wraps yaw into -180 .. 180, ignores an unknown look-at", async function () {
  const s = await load();
  const p = s.povDefaults(CFG);
  const q = s.setCamera(p, { eyeHeight: 9, distance: 0.01, fov: 500, roll: -90, yaw: 190, lookAt: "feet" }, CFG);
  assert.deepStrictEqual(q.camera, { yaw: -170, eyeHeight: 2.2, distance: 0.3, fov: 100, roll: -45, lookAt: "chest" });
  assert.strictEqual(s.setCamera(p, { yaw: -181 }, CFG).camera.yaw, 179);
  assert.strictEqual(s.setCamera(p, { lookAt: "head" }, CFG).camera.lookAt, "head");
  assert.strictEqual(p.camera.yaw, 0, "input not changed");
});

test("presets set yaw / eye height only; unknown preset -> null; reset gives the defaults", async function () {
  const s = await load();
  let p = s.setCamera(s.povDefaults(CFG), { distance: 2, fov: 40 }, CFG);
  p = s.applyPreset(p, "back", CFG);
  assert.deepStrictEqual([p.camera.yaw, p.camera.eyeHeight, p.camera.distance, p.camera.fov], [180, 1.55, 2, 40]);
  assert.strictEqual(s.applyPreset(p, "right", CFG).camera.yaw, -90);
  assert.strictEqual(s.applyPreset(p, "top", CFG).camera.eyeHeight, 2.2);
  assert.strictEqual(s.applyPreset(p, "nope", CFG), null);
  assert.deepStrictEqual(s.resetCamera(p, CFG).camera, s.povDefaults(CFG).camera);
});

test("orbit: drag right = yaw up, drag up = eye higher; wheel = distance; all clamped", async function () {
  const s = await load();
  const p = s.povDefaults(CFG);
  const q = s.orbit(p, 20, -40, CFG);
  assert.strictEqual(q.camera.yaw, 10);
  assert.strictEqual(q.camera.eyeHeight, 1.75);
  assert.strictEqual(s.zoom(p, 100, CFG).camera.distance, 1.3);
  assert.strictEqual(s.zoom(p, -100000, CFG).camera.distance, 0.3);
});

test("nextView cycles source -> pov -> split -> source", async function () {
  const s = await load();
  assert.strictEqual(s.nextView("source", CFG.pov.views), "pov");
  assert.strictEqual(s.nextView("split", CFG.pov.views), "source");
});

test("setOptions accepts only known values: view, person, output, framing, margins, layers, threshold, names", async function () {
  const s = await load();
  const p = s.povDefaults(CFG);
  const q = s.setOptions(p, { view: "pov", person: 1, outMode: "landscape", framing: "true", margins: { top: 0.2 },
    layers: { mp: false }, threshold: 0.5, names: { shot: "walk01" }, srcCamera: false, custom: [900, 700] }, CFG);
  assert.deepStrictEqual([q.view, q.person, q.outMode, q.framing, q.threshold, q.srcCamera], ["pov", 1, "landscape", "true", 0.5, false]);
  assert.deepStrictEqual(q.margins, { top: 0.2, bottom: 0.09, sides: 0.05 });
  assert.deepStrictEqual(q.layers, { op: true, mp: false, face: true });
  assert.deepStrictEqual(q.names, { shot: "walk01", character: "" });
  assert.deepStrictEqual(q.custom, [900, 700]);
  assert.deepStrictEqual([s.setOptions(p, { depth: 0 }, CFG).depth, s.setOptions(p, { depth: 0.52 }, CFG).depth], [0.05, 0.5]);
  const bad = s.setOptions(p, { view: "top", person: 5, outMode: "x", framing: "y", threshold: 3, margins: { top: -1 } }, CFG);
  assert.deepStrictEqual([bad.view, bad.person, bad.outMode, bad.framing, bad.threshold, bad.margins.top], ["source", 0, "portrait", "fit", 1, 0]);
});
