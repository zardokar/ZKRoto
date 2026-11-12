// Unit tests for web/js/zk_naming.js (shot prefix, camera name, file names, sub-folders, capture folder).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_naming.js")).href;
const CAM = { yaw: 35, eyeHeight: 1.55, distance: 1.2, fov: 60, roll: 0 };
const PORTRAIT = { mode: "portrait", width: 832, height: 1216 };

function load() {
  return import(MODULE);
}

test("prefix = <shot>_<character>; empty shot = clip name; empty character left out", async function () {
  const n = await load();
  assert.strictEqual(n.shotPrefix({ shot: "walk01", character: "FRA-007", clip: "clip.mp4" }), "walk01_FRA-007");
  assert.strictEqual(n.shotPrefix({ shot: "", character: "FRA-007", clip: "zkroto_test_fra007.mp4" }), "zkroto-test-fra007_FRA-007");
  assert.strictEqual(n.shotPrefix({ shot: "walk01", character: "", clip: "clip.mp4" }), "walk01");
  assert.strictEqual(n.shotPrefix({ shot: " ", character: " ", clip: "a b.mp4" }), "a-b");
  assert.deepStrictEqual(n.shotParts({ shot: "", character: "FRA_007", clip: "c.mp4" }), { shot: "c", character: "FRA-007" });
});

test("shotProblem: empty shot -> noShot; Windows device names and 'capture' -> reservedShot; else null", async function () {
  const n = await load();
  assert.strictEqual(n.shotProblem(n.shotParts({ shot: "", clip: "เดิน.mp4" })), "noShot");
  for (const bad of ["CON", "nul", "Com1", "lpt9", "capture"]) {
    assert.strictEqual(n.shotProblem({ shot: bad, character: "" }), "reservedShot", bad);
  }
  assert.strictEqual(n.shotProblem({ shot: "console", character: "" }), null);
});

test("cleanName keeps letters, digits and '-' only (no '_', no slashes, no dots)", async function () {
  const n = await load();
  assert.strictEqual(n.cleanName("walk_01"), "walk-01");
  assert.strictEqual(n.cleanName("../x\\y/z"), "x-y-z");
  assert.strictEqual(n.cleanName("  FRA-007 "), "FRA-007");
  assert.strictEqual(n.cleanName("--a--b--"), "a-b");
  assert.strictEqual(n.cleanName("ตัวละคร"), "");
});

test("camera name pov_y035_h155_d120_f60; -90 -> y270; roll -10 -> _rm10, 10 -> _r10; Landscape -> _L", async function () {
  const n = await load();
  assert.strictEqual(n.cameraName(CAM, PORTRAIT), "pov_y035_h155_d120_f60");
  assert.strictEqual(n.cameraName({ ...CAM, yaw: -90 }, PORTRAIT), "pov_y270_h155_d120_f60");
  assert.strictEqual(n.cameraName({ ...CAM, yaw: 180 }, PORTRAIT), "pov_y180_h155_d120_f60");
  assert.strictEqual(n.cameraName({ ...CAM, yaw: -180 }, PORTRAIT), "pov_y180_h155_d120_f60");
  assert.strictEqual(n.cameraName({ ...CAM, roll: -10 }, PORTRAIT), "pov_y035_h155_d120_f60_rm10");
  assert.strictEqual(n.cameraName({ ...CAM, roll: 10 }, PORTRAIT), "pov_y035_h155_d120_f60_r10");
  assert.strictEqual(n.cameraName(CAM, { mode: "landscape", width: 1216, height: 832 }), "pov_y035_h155_d120_f60_L");
  assert.strictEqual(n.cameraName(CAM, { mode: "custom", width: 1024, height: 1024 }), "pov_y035_h155_d120_f60_c1024x1024");
});

test("camera name rounds to whole degrees and centimetres; the same camera gives the same name", async function () {
  const n = await load();
  const a = n.cameraName({ yaw: 34.6, eyeHeight: 1.554, distance: 0.3, fov: 100, roll: 0.2 }, PORTRAIT);
  assert.strictEqual(a, "pov_y035_h155_d030_f100");
  assert.strictEqual(n.cameraName({ ...CAM }, PORTRAIT), n.cameraName(CAM, PORTRAIT));
});

test("file names: src fixed per frame, pov from the camera, zkroto per frame + shot, sheet per camera", async function () {
  const n = await load();
  const pov = n.fileNames("walk01_FRA-007", 123, 6, "pov_y035_h155_d120_f60");
  assert.deepStrictEqual(pov, {
    opPng: "walk01_FRA-007_f000123_pov_y035_h155_d120_f60.png",
    opJson: "walk01_FRA-007_f000123_pov_y035_h155_d120_f60.json",
    mpJson: "walk01_FRA-007_f000123_pov_y035_h155_d120_f60.json",
    sheet: "walk01_FRA-007_sheet_pov_y035_h155_d120_f60.png",
    frameJson: "walk01_FRA-007_f000123.json",
    shotJson: "walk01_FRA-007_shot.json",
  });
  assert.strictEqual(n.fileNames("walk01_FRA-007", 123, 6, "src").opPng, "walk01_FRA-007_f000123_src.png");
});

test("sub-folders: openpose/src|pov, mediapipe/src|pov, the face/ folders inside both, openpose/full (body + face), mediapipe (sheets), zkroto", async function () {
  const n = await load();
  assert.deepStrictEqual(n.subFolders("src"), { op: "openpose/src", mp: "mediapipe/src", faceOp: "openpose/face/src",
    faceMp: "mediapipe/face/src", full: "openpose/full/src", sheet: "mediapipe", zk: "zkroto" });
  assert.deepStrictEqual(n.subFolders("pov_y035_h155_d120_f60"), { op: "openpose/pov", mp: "mediapipe/pov", faceOp: "openpose/face/pov",
    faceMp: "mediapipe/face/pov", full: "openpose/full/pov", sheet: "mediapipe", zk: "zkroto" });
});

test("capture sub-folder: <app>/capture/<clip base>", async function () {
  const n = await load();
  assert.strictEqual(n.captureSubfolder("ZKRoto", "capture", "zkroto_test_2997"), "ZKRoto/capture/zkroto_test_2997");
});
