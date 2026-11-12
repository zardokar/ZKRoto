// Unit tests for web/js/zk_posejson.js (OpenPose JSON, MediaPipe JSON, zkroto frame JSON, shot index).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_posejson.js")).href;

function load() {
  return import(MODULE);
}

function points(n, x) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push([x + i + 0.123456, x + 0.98765, 0.876543]);
  }
  return out;
}

test("OpenPose JSON: canvas size + people[0].pose_keypoints_2d with 54 numbers, pixels 2 decimals, c 4", async function () {
  const j = await load();
  const out = j.openposeJson(points(18, 10), 832, 1216);
  assert.deepStrictEqual(Object.keys(out), ["canvas_width", "canvas_height", "people"]);
  assert.strictEqual(out.canvas_width, 832);
  assert.strictEqual(out.people.length, 1);
  assert.deepStrictEqual(Object.keys(out.people[0]), ["pose_keypoints_2d"]);
  const k = out.people[0].pose_keypoints_2d;
  assert.strictEqual(k.length, 54);
  assert.deepStrictEqual(k.slice(0, 3), [10.12, 10.99, 0.8765]);
});

test("MediaPipe JSON: frame, camera, size, 33 points [x, y, vis] in pixels (99 numbers), 33 world [x, y, z]", async function () {
  const j = await load();
  const world = points(33, 0).map(function (p) {
    return [p[0] / 10, -0.123456, 0.0000449];
  });
  const out = j.mediapipeJson({ frame: 123, camera: "src", width: 1920, height: 1080, points: points(33, 5), world });
  assert.deepStrictEqual(Object.keys(out), ["frame", "camera", "width", "height", "points", "world"]);
  assert.strictEqual(out.points.flat().length, 99);
  assert.deepStrictEqual(out.points[0], [5.12, 5.99, 0.8765]);
  assert.deepStrictEqual(out.world[0], [0.0123, -0.1235, 0]);
});

test("zkroto frame JSON: our record with the cameras of this export, merged with the cameras already there", async function () {
  const j = await load();
  const base = { version: "0.2.0", shot: "walk01", character: "FRA-007", clip: "clip.mp4", frame: 123, fps: "30000/1001",
    time: 4.119123456, person: 0, swapped: false };
  const pov = { yaw: 35, eyeHeight: 1.55, distance: 1.2, fov: 60, roll: 0, lookAt: "chest", size: [832, 1216], framing: "fit",
    margin: [0.1, 0.09, 0.05] };
  const first = j.frameJson(null, base, { src: { size: [1920, 1080] } });
  assert.deepStrictEqual(Object.keys(first), ["version", "shot", "character", "clip", "frame", "fps", "time", "person", "swapped", "edited",
    "cameras"]);
  assert.strictEqual(first.time, 4.1191);
  const second = j.frameJson(first, { ...base, swapped: true }, { pov_y035_h155_d120_f60: pov });
  assert.deepStrictEqual(Object.keys(second.cameras), ["src", "pov_y035_h155_d120_f60"]);
  assert.strictEqual(second.swapped, true);
});

test("face JSON: OpenPose face_keypoints_2d with 210 numbers; MediaPipe face 478 points + 478 world", async function () {
  const j = await load();
  const op = j.openposeFaceJson(points(70, 3), 832, 1216);
  assert.deepStrictEqual(Object.keys(op.people[0]), ["face_keypoints_2d"]);
  assert.strictEqual(op.people[0].face_keypoints_2d.length, 210);
  const world = points(478, 0).map(function (p) {
    return [p[0], p[1], p[2]];
  });
  const mp = j.mediapipeJson({ frame: 1, camera: "src", width: 9, height: 9, points: points(478, 1), world });
  assert.strictEqual(mp.points.length, 478);
});

test("shot index: frames in order, each with the cameras exported so far, no duplicates", async function () {
  const j = await load();
  const base = { version: "0.2.0", shot: "walk01", character: "FRA-007", clip: "clip.mp4", fps: "30000/1001" };
  let s = j.shotJson(null, base, 123, ["src", "pov_a"]);
  s = j.shotJson(s, base, 120, ["pov_a"]);
  s = j.shotJson(s, base, 123, ["pov_b", "src"]);
  assert.deepStrictEqual(Object.keys(s), ["version", "shot", "character", "clip", "fps", "frames"]);
  assert.deepStrictEqual(s.frames, [{ frame: 120, cameras: ["pov_a"] }, { frame: 123, cameras: ["src", "pov_a", "pov_b"] }]);
});

test("framesFor(shot, camera) lists the exported frames of one camera in order", async function () {
  const j = await load();
  const s = { frames: [{ frame: 120, cameras: ["pov_a"] }, { frame: 123, cameras: ["src", "pov_a"] }, { frame: 7, cameras: ["src"] }] };
  assert.deepStrictEqual(j.framesFor(s, "src"), [7, 123]);
  assert.deepStrictEqual(j.framesFor(null, "src"), []);
});
