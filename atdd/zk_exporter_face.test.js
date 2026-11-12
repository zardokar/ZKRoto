// Export of the face layer: OpenPose face 70 and MediaPipe face 478 per camera, in the face folders (design 1.12),
// and the combined OpenPose PNG (body 18 + face 70 on one canvas) in openpose/full/ (design 1.13 F1, choice A).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { setup } = require("./exporter_kit.js");

const POV = "pov_y000_h155_d120_f60";
const FACE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "front_pose_face.json"), "utf8")).person;

test("a person with a face: OpenPose face 70 (PNG + JSON) and MediaPipe face 478 per camera, in the face folders", async function () {
  const { ex, povApi, server } = await setup([FACE]);
  povApi.options({ view: "pov", names: { shot: "walk01" } });
  await ex.exportPose();
  for (const cam of ["src", POV]) {
    const side = cam === "src" ? "src" : "pov";
    assert.ok(server.files[`openpose/face/${side}/walk01_f000123_${cam}.png`], `face png ${cam}`);
    assert.ok(server.files[`openpose/full/${side}/walk01_f000123_${cam}.png`], `full png ${cam}`);
    assert.strictEqual(server.files[`openpose/full/${side}/walk01_f000123_${cam}.json`], undefined, "full: PNG only");
    const op = server.files[`openpose/face/${side}/walk01_f000123_${cam}.json`].json;
    assert.strictEqual(op.people[0].face_keypoints_2d.length, 210);
    const mp = server.files[`mediapipe/face/${side}/walk01_f000123_${cam}.json`].json;
    assert.deepStrictEqual([mp.points.length, mp.world.length, mp.camera], [478, 478, cam]);
  }
});

test("no face for the person: no face files", async function () {
  const { ex, server } = await setup();
  await ex.exportPose();
  assert.strictEqual(Object.keys(server.files).some(function (k) {
    return k.includes("face/");
  }), false);
});
