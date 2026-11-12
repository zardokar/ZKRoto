// Export (Ctrl+E) without a browser: web/js/zk_exporter.js with the POV facade, a fake canvas and a fake server.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { setup, PERSON } = require("./exporter_kit.js");

const POV = "pov_y000_h155_d120_f60";

test("source view, source camera ticked: runs Pose first, writes src files, records and the src sheet", async function () {
  const { ex, povApi, server, calls } = await setup();
  povApi.options({ names: { shot: "walk01", character: "FRA-007" } });
  const out = await ex.exportPose();
  assert.strictEqual(calls(), 1);
  assert.strictEqual(out.folder, "walk01_FRA-007");
  assert.deepStrictEqual(Object.keys(server.files).sort(), [
    "mediapipe/src/walk01_FRA-007_f000123_src.json",
    "mediapipe/walk01_FRA-007_sheet_src.png",
    "openpose/full/src/walk01_FRA-007_f000123_src.png",
    "openpose/src/walk01_FRA-007_f000123_src.json",
    "openpose/src/walk01_FRA-007_f000123_src.png",
    "zkroto/walk01_FRA-007_f000123.json",
    "zkroto/walk01_FRA-007_shot.json",
  ]);
  assert.strictEqual(out.files.length, 7);
  const op = server.files["openpose/src/walk01_FRA-007_f000123_src.json"].json;
  assert.deepStrictEqual([op.canvas_width, op.canvas_height, op.people[0].pose_keypoints_2d.length], [1024, 1536, 54]);
});

test("POV view: src + POV files in their own folders; zkroto JSON holds both cameras; shot index both", async function () {
  const { ex, povApi, server } = await setup();
  povApi.options({ view: "pov", names: { character: "FRA-007" } });
  await ex.exportPose();
  const pre = "clip_FRA-007";
  assert.ok(server.files[`openpose/pov/${pre}_f000123_${POV}.png`]);
  assert.ok(server.files[`openpose/full/pov/${pre}_f000123_${POV}.png`], "full POV png (body only: no face)");
  const mp = server.files[`mediapipe/pov/${pre}_f000123_${POV}.json`].json;
  assert.deepStrictEqual([mp.camera, mp.width, mp.height, mp.points.length, mp.world.length], [POV, 832, 1216, 33, 33]);
  const rec = server.files[`zkroto/${pre}_f000123.json`].json;
  assert.deepStrictEqual(Object.keys(rec.cameras), ["src", POV]);
  assert.deepStrictEqual(rec.cameras[POV].margin, [0.1, 0.09, 0.05]);
  assert.deepStrictEqual([rec.shot, rec.character, rec.clip, rec.fps, rec.time], ["clip", "FRA-007", "clip.mp4", "30000/1001", 4.1041]);
  assert.deepStrictEqual(server.files[`zkroto/${pre}_shot.json`].json.frames, [{ frame: 123, cameras: ["src", POV] }]);
  assert.ok(server.files[`mediapipe/${pre}_sheet_${POV}.png`]);
});

test("another frame: Pose runs again (not after Swap); earlier entries kept; Swap recorded", async function () {
  const { ex, povApi, server, state, calls } = await setup([PERSON, PERSON]);
  await ex.exportPose();
  state.frame = 124;
  povApi.options({ view: "split" });
  await ex.exportPose({ src: false });
  povApi.swap();
  await ex.exportPose({ src: false });
  const shot = server.files["zkroto/clip_shot.json"].json;
  assert.deepStrictEqual(shot.frames, [{ frame: 123, cameras: ["src"] }, { frame: 124, cameras: [POV] }]);
  assert.strictEqual(server.files["zkroto/clip_f000124.json"].json.swapped, true);
  assert.strictEqual(calls(), 2, "pose for frame 123 and 124, kept after Swap");
});

test("one Export at a time; a seek (pose cleared) during the network calls does not break the running one", async function () {
  const { ex, server, state } = await setup();
  const real = server.fetch;
  let first = true;
  server.fetch = async function (url, opts) {
    if (first) {
      first = false;
      state.lastPose = null;
      state.frame = 50;
    }
    return real(url, opts);
  };
  const a = ex.exportPose();
  await assert.rejects(ex.exportPose(), /still running/);
  const out = await a;
  assert.strictEqual(out.frame, 123);
  assert.ok(server.files["zkroto/clip_f000123.json"]);
});

test("shot name problems are said plainly before anything is sent; person and swap kept per camera", async function () {
  const { ex, povApi, server, state } = await setup();
  state.name = "เดิน.mp4";
  await assert.rejects(ex.exportPose(), /enter a shot name/);
  povApi.options({ names: { shot: "CON" } });
  await assert.rejects(ex.exportPose(), /not allowed/);
  assert.deepStrictEqual(server.posts, []);
  povApi.options({ names: { shot: "walk01" }, view: "pov" });
  await ex.exportPose();
  const rec = server.files["zkroto/walk01_f000123.json"].json;
  assert.deepStrictEqual([rec.cameras.src.person, rec.cameras.src.swapped, rec.cameras[POV].person], [0, false, 0]);
});

test("nothing to export: source view with the source camera unticked", async function () {
  const { ex } = await setup();
  await assert.rejects(ex.exportPose({ src: false }), /nothing to export/);
});

test("person 2 missing in this frame -> error, no files", async function () {
  const { ex, povApi, server } = await setup();
  povApi.person(1);
  await assert.rejects(ex.exportPose(), /no person 2/);
  assert.deepStrictEqual(server.posts, []);
});

test("edited points (0.3.0): the zkroto frame JSON lists them per person (empty list when none)", async function () {
  const a = await setup([{ ...PERSON, edited: [15, 16] }]);
  a.povApi.options({ names: { shot: "walk01", character: "FRA-007" } });
  await a.ex.exportPose();
  assert.deepStrictEqual(a.server.files["zkroto/walk01_FRA-007_f000123.json"].json.edited, [15, 16]);
  const b = await setup();
  b.povApi.options({ names: { shot: "walk01", character: "FRA-007" } });
  await b.ex.exportPose();
  assert.deepStrictEqual(b.server.files["zkroto/walk01_FRA-007_f000123.json"].json.edited, []);
});
