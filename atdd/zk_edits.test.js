// Point editing (0.3.0), pure part web/js/zk_edits.js: the edits document (only moved MediaPipe points, image
// coordinates 0..1, per frame and person), applying it to a pose (image x / y replaced, world x / y moved by the
// same pixels in metres) and finding the point under the mouse.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { CFG, PERSON, load } = require("./exporter_kit.js");

const W = 1024;
const H = 1536;

function pose(frame) {
  return { frame, width: W, height: H, people: [PERSON, { ...PERSON, image: PERSON.image.map(function (p) {
    return [p[0] + 0.1, p[1], p[2], p[3]];
  }) }] };
}

test("document: set / clear a point, clear a frame; the old document is never changed", async function () {
  const E = await load("zk_edits.js");
  const a = E.emptyEdits("clip.mp4");
  const b = E.setPoint(a, 12, 0, 15, [0.5, 0.25]);
  assert.deepStrictEqual(a.frames, {});
  assert.deepStrictEqual(E.frameEdits(b, 12, 0), { 15: [0.5, 0.25] });
  assert.strictEqual(E.frameEdits(b, 12, 1), null);
  assert.strictEqual(E.frameEdits(b, 13, 0), null);
  const c = E.setPoint(b, 12, 1, 3, [0.1, 0.2]);
  assert.deepStrictEqual(E.frameEdits(E.clearPoint(c, 12, 0, 15), 12, 0), null);
  assert.deepStrictEqual(E.clearPoint(E.clearPoint(c, 12, 0, 15), 12, 1, 3).frames, {}, "empty levels removed");
  assert.deepStrictEqual(E.clearFrame(c, 12).frames, {});
  assert.deepStrictEqual(E.editedFrames(c), [12]);
  assert.deepStrictEqual(E.setPoint(a, 1, 0, 0, [0.123456789, 1.5]).frames["1"]["0"]["0"], [0.12346, 1], "rounded, clamped 0..1");
});

test("apply: the edited point moves in the image and in the world by the same pixels; other points stay", async function () {
  const E = await load("zk_edits.js");
  const { metresPerPixel } = await load("zk_facefit.js");
  const doc = E.setPoint(E.emptyEdits("clip.mp4"), 7, 0, 15, [0.6, 0.5]);
  const raw = pose(7);
  const out = E.applyEdits(raw, doc);
  const p = out.people[0];
  const k = metresPerPixel(PERSON, W, H);
  assert.deepStrictEqual(p.image[15].slice(0, 2), [0.6, 0.5]);
  assert.deepStrictEqual([p.image[15][2], p.image[15][3]], [PERSON.image[15][2], PERSON.image[15][3]], "z and visibility kept");
  const dx = (0.6 - PERSON.image[15][0]) * W * k;
  const dy = (0.5 - PERSON.image[15][1]) * H * k;
  assert.ok(Math.abs(p.world[15][0] - (PERSON.world[15][0] + dx)) < 1e-9);
  assert.ok(Math.abs(p.world[15][1] - (PERSON.world[15][1] + dy)) < 1e-9);
  assert.strictEqual(p.world[15][2], PERSON.world[15][2]);
  assert.deepStrictEqual(p.image[14], PERSON.image[14]);
  assert.deepStrictEqual(p.edited, [15]);
  assert.deepStrictEqual(out.people[1], raw.people[1], "person 2 untouched");
  assert.strictEqual(out.raw, raw, "the MediaPipe pose is kept as raw");
  assert.strictEqual(E.applyEdits(out, E.emptyEdits("clip.mp4")).people[0].image[15], PERSON.image[15], "re-applied from raw");
  assert.strictEqual(E.applyEdits(pose(8), doc).people[0].edited, undefined, "another frame: no edits");
});

test("apply after Swap: edits follow the person as shown (raw is swapped with the people)", async function () {
  const E = await load("zk_edits.js");
  const { swapPose } = await load("zk_poseshape.js");
  const doc = E.setPoint(E.emptyEdits("c"), 7, 0, 0, [0.9, 0.9]);
  const raw = pose(7);
  const swapped = swapPose(E.applyEdits(raw, E.emptyEdits("c")));
  assert.strictEqual(swapped.raw.people[0], raw.people[1], "Swap also swaps the raw MediaPipe people");
  const out = E.applyEdits(swapped, doc);
  assert.deepStrictEqual(out.people[0].image[0].slice(0, 2), [0.9, 0.9]);
  assert.ok(Math.abs(out.people[0].image[1][0] - (PERSON.image[1][0] + 0.1)) < 1e-9, "shown person 1 = MediaPipe person 2");
});

test("the POV follows an edit in 'MediaPipe 3D' and in 'the image' modes", async function () {
  const E = await load("zk_edits.js");
  const { povPoints } = await load("zk_pov.js");
  const { povDefaults } = await load("zk_povstate.js");
  const doc = E.setPoint(E.emptyEdits("c"), 7, 0, 15, [PERSON.image[15][0] + 0.05, PERSON.image[15][1]]);
  const out = E.applyEdits(pose(7), doc).people[0];
  for (const xy of ["world", "image"]) {
    const pov = { ...povDefaults(CFG), xy, framing: "true" };
    const a = povPoints(PERSON, pov, [832, 1216], CFG, { width: W, height: H });
    const b = povPoints(out, pov, [832, 1216], CFG, { width: W, height: H });
    assert.ok(Math.abs(b.mp[15][0] - a.mp[15][0]) > 5, `${xy}: wrist moved in the POV`);
    assert.ok(Math.abs(b.mp[14][0] - a.mp[14][0]) < 1e-6, `${xy}: other joints did not move`);
  }
});

test("nearest: the point under the mouse within the radius, else -1; hidden people ignored", async function () {
  const E = await load("zk_edits.js");
  const pts = [[0.1, 0.1], [0.5, 0.5], [0.52, 0.5]];
  assert.strictEqual(E.nearest(pts, 1000, 1000, 515, 500, 12), 2);
  assert.strictEqual(E.nearest(pts, 1000, 1000, 300, 300, 12), -1);
});

test("parse: a document of another clip is not used (empty edits instead, with the reason)", async function () {
  const E = await load("zk_edits.js");
  const good = E.setPoint(E.emptyEdits("clip.mp4"), 1, 0, 2, [0.2, 0.3]);
  assert.deepStrictEqual(E.parseEdits(JSON.parse(JSON.stringify(good)), "clip.mp4"), { doc: good, problem: null });
  const other = E.parseEdits(good, "else.mp4");
  assert.deepStrictEqual([other.doc.frames, other.problem], [{}, "otherClip"]);
  assert.deepStrictEqual(E.parseEdits(null, "clip.mp4"), { doc: E.emptyEdits("clip.mp4"), problem: null });
  assert.strictEqual(E.parseEdits({ version: 99, clip: "clip.mp4", frames: {} }, "clip.mp4").problem, "badEdits");
});
