// Face layer logic: head crop (zk_facecrop.js), MediaPipe 478 -> OpenPose face 70 (zk_openface.js), best-fit placement
// of the face mesh into the body's world (zk_facefit.js). Fixture: FRA-007 front.png, Pose + Face Landmarker.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const JS = path.join(__dirname, "..", "web", "js");
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "config", "zkroto.json"), "utf8"));
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "front_pose_face.json"), "utf8"));
const P = FIX.person;
const W = FIX.width;
const H = FIX.height;

function load(name) {
  return import(pathToFileURL(path.join(JS, name)).href);
}

function mean(points) {
  const n = points.length;
  return [0, 1].map(function (k) {
    return points.reduce(function (s, p) {
      return s + p[k];
    }, 0) / n;
  });
}

test("head crop: square around nose and ears, side = torso length x cropScale; back to frame coordinates", async function () {
  const c = await load("zk_facecrop.js");
  const crop = c.headCrop(P.image, W, H, CFG.face.cropScale);
  assert.ok(Math.abs(crop.size - 318.2) < 1, String(crop.size));
  const nose = [P.image[0][0] * W, P.image[0][1] * H];
  const ears = [((P.image[7][0] + P.image[8][0]) / 2) * W, ((P.image[7][1] + P.image[8][1]) / 2) * H];
  assert.ok(Math.abs(crop.x + crop.size / 2 - (nose[0] + ears[0]) / 2) < 1e-9, "centre x between nose and ears");
  assert.ok(Math.abs(crop.y + crop.size / 2 - (nose[1] + ears[1]) / 2) < 1e-9, "centre y between nose and ears");
  const back = c.cropToFrame([[0.5, 0.5, 0.1]], crop, W, H)[0];
  assert.deepStrictEqual(back, [(crop.x + crop.size / 2) / W, (crop.y + crop.size / 2) / H, (0.1 * crop.size) / W]);
});

test("OpenPose face 70: 68 points in dlib order + 2 pupils, from the 478 MediaPipe points", async function () {
  const o = await load("zk_openface.js");
  assert.strictEqual(o.FACE70.length, 70);
  assert.strictEqual(new Set(o.FACE70).size, 70);
  const px = P.face.image.map(function (p) {
    return [p[0] * W, p[1] * H, 1];
  });
  const f = o.toOpenFace(px);
  assert.strictEqual(f.length, 70);
  assert.ok(f[0][0] < f[16][0], "jaw 0 on the image left (the person's right) for a face to the camera");
  assert.ok(f[8][1] > f[30][1] && f[30][1] > f[27][1], "chin below nose tip below nose bridge");
  const rightEye = mean(f.slice(36, 42));
  const leftEye = mean(f.slice(42, 48));
  assert.ok(Math.hypot(f[68][0] - rightEye[0], f[68][1] - rightEye[1]) < 8, "pupil 68 in eye 36-41");
  assert.ok(Math.hypot(f[69][0] - leftEye[0], f[69][1] - leftEye[1]) < 8, "pupil 69 in eye 42-47");
  assert.ok(f[48][0] < f[54][0], "mouth corner 48 on the image left");
});

test("metres per pixel from the torso: shoulders + both sides, world x / y over image pixels", async function () {
  const fit = await load("zk_facefit.js");
  const k = fit.metresPerPixel(P, W, H);
  assert.ok(Math.abs(k - 1.057e-3) < 0.005e-3, String(k));
});

test("face mesh in the body's world keeps its own shape: every offset in the image x metres per pixel", async function () {
  const fit = await load("zk_facefit.js");
  const world = fit.faceWorld(P, W, H);
  const k = fit.metresPerPixel(P, W, H);
  assert.strictEqual(world.length, 478);
  for (const i of [1, 152, 234, 454, 468]) {
    const dx = (P.face.image[i][0] - P.image[0][0]) * W * k;
    const dy = (P.face.image[i][1] - P.image[0][1]) * H * k;
    assert.ok(Math.abs(world[i][0] - P.world[0][0] - dx) < 1e-12 && Math.abs(world[i][1] - P.world[0][1] - dy) < 1e-12, `${i}`);
  }
  assert.ok(Math.abs(world[1][2] - P.world[0][2]) < 1e-12, "mesh nose tip at the depth of the pose nose");
  const width = Math.hypot(world[234][0] - world[454][0], world[234][1] - world[454][1], world[234][2] - world[454][2]);
  assert.ok(width > 0.1 && width < 0.16, `face width ${width.toFixed(3)} m`);
});

test("faceForward points from the face towards the source camera for a face looking at it (MediaPipe -z)", async function () {
  const fit = await load("zk_facefit.js");
  const f = fit.faceForward(P, W, H);
  assert.ok(f[2] < -0.7, JSON.stringify(f));
});
