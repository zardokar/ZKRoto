// Point editing (0.3.0), service web/js/zk_editstore.js: edit mode, move / reset a point of the chosen person on the
// shown frame, read and write <shot>_<character>_edits.json in zkroto\ through the existing routes.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { CFG, K, PERSON, load, fakeServer } = require("./exporter_kit.js");

async function setup(seed) {
  const { createBus, EVENTS } = await load("zk_events.js");
  const { createEditStore } = await load("zk_editstore.js");
  const { povDefaults } = await load("zk_povstate.js");
  const { fmt } = await load("zk_text.js");
  const server = fakeServer();
  if (seed) {
    server.files[`zkroto/walk01_clip_edits.json`] = { json: seed };
  }
  const state = { name: "clip.mp4", url: "blob:x", frame: 7, lastPose: { frame: 7, width: 1024, height: 1536, people: [PERSON] },
    pov: { ...povDefaults(CFG), names: { shot: "walk01", character: "clip" } } };
  const logs = [];
  const bus = createBus();
  let poses = 0;
  bus.on(EVENTS.pose, function () {
    poses += 1;
  });
  const ctx = { cfg: CFG, k: K, state, bus, t: function (key, v) {
    return fmt(K.text[key], v || {});
  }, log: function (m) {
    logs.push(m);
  }, status: function () {
    return null;
  } };
  const store = createEditStore(ctx, { fetch: function (u, i) {
    return server.fetch(u, i);
  } });
  return { store, state, server, logs, poses: function () {
    return poses;
  } };
}

test("edit mode on / off; move a point (video pixels) -> shown pose changes, file written, event sent", async function () {
  const { store, state, server, poses } = await setup();
  assert.strictEqual(store.mode(), false);
  assert.strictEqual(store.mode(true), true);
  await store.movePoint(15, 512, 768);
  assert.deepStrictEqual(state.lastPose.people[0].image[15].slice(0, 2), [0.5, 0.5]);
  assert.deepStrictEqual(state.lastPose.people[0].edited, [15]);
  const file = server.files["zkroto/walk01_clip_edits.json"].json;
  assert.deepStrictEqual(file.frames, { 7: { 0: { 15: [0.5, 0.5] } } });
  assert.strictEqual(file.clip, "clip.mp4");
  assert.ok(poses() >= 1);
  await store.resetPoint(15);
  assert.deepStrictEqual(state.lastPose.people[0].image[15], PERSON.image[15]);
  assert.deepStrictEqual(server.files["zkroto/walk01_clip_edits.json"].json.frames, {});
});

test("reset frame clears every point of the shown frame; edits of other frames stay", async function () {
  const { store, state, server } = await setup({ version: 1, clip: "clip.mp4", frames: { 3: { 0: { 1: [0.1, 0.1] } } } });
  await store.movePoint(0, 100, 100);
  await store.movePoint(2, 200, 200);
  await store.resetFrame();
  assert.strictEqual(state.lastPose.people[0].edited, undefined);
  assert.deepStrictEqual(server.files["zkroto/walk01_clip_edits.json"].json.frames, { 3: { 0: { 1: [0.1, 0.1] } } });
});

test("apply(pose) reads the file once per shot folder and puts saved edits on a new pose of that frame", async function () {
  const { store, server } = await setup({ version: 1, clip: "clip.mp4", frames: { 7: { 0: { 11: [0.3, 0.2] } } } });
  const out = await store.apply({ frame: 7, width: 1024, height: 1536, people: [PERSON] });
  assert.deepStrictEqual(out.people[0].image[11].slice(0, 2), [0.3, 0.2]);
  await store.apply({ frame: 8, width: 1024, height: 1536, people: [PERSON] });
  assert.strictEqual(server.gets().filter(function (u) {
    return u.includes("edits");
  }).length, 1, "read once");
});

test("a file of another clip is not used and is not overwritten until a point is moved; the log says why", async function () {
  const { store, logs, server } = await setup({ version: 1, clip: "other.mp4", frames: { 7: { 0: { 11: [0.3, 0.2] } } } });
  const out = await store.apply({ frame: 7, width: 1024, height: 1536, people: [PERSON] });
  assert.deepStrictEqual(out.people[0].image[11], PERSON.image[11]);
  assert.ok(logs.some(function (m) {
    return m.includes("other.mp4");
  }));
  assert.strictEqual(server.files["zkroto/walk01_clip_edits.json"].json.clip, "other.mp4");
});

test("move / reset need a pose of the shown frame and a point index 0..32", async function () {
  const { store, state } = await setup();
  await assert.rejects(store.movePoint(33, 1, 1), /point/);
  state.lastPose = null;
  await assert.rejects(store.movePoint(1, 1, 1), /pose/i);
});
