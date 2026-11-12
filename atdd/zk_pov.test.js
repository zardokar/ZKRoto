// Unit tests for web/js/zk_pov.js on the recorded FRA-007 pose (zkroto_test_fra007.mp4 frame 10, 0.1.1):
// source points, POV points, same pixel for shared joints, yaw 0 ~ source, yaw 180 = mirror.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const JS = path.join(__dirname, "..", "web", "js");
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "config", "zkroto.json"), "utf8"));
const PERSON = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pose_fra007_f10_v011.json"), "utf8"))[0];
const VIDEO = [1024, 1536];
const SIZE = [832, 1216];
const MP_OF_OP = [0, -1, 12, 14, 16, 11, 13, 15, 24, 26, 28, 23, 25, 27, 5, 2, 8, 7];
const PAIRS = [[2, 5], [3, 6], [4, 7], [8, 11], [9, 12], [10, 13], [14, 15], [16, 17]];

function load(name) {
  return import(pathToFileURL(path.join(JS, name)).href);
}

async function setup(camera) {
  const s = await load("zk_povstate.js");
  const v = await load("zk_pov.js");
  const pov = s.setCamera(s.povDefaults(CFG), camera || {}, CFG);
  return { s, v, pov };
}

// mean and max distance between two OpenPose lists over joints visible in both, as a fraction of the height
function diff(a, b, mirror) {
  const d = [];
  a.forEach(function (p, i) {
    const q = b[i];
    if (p[2] > 0 && q[2] > 0) {
      const x = mirror ? SIZE[0] - q[0] : q[0];
      d.push(Math.hypot(p[0] - x, p[1] - q[1]) / SIZE[1]);
    }
  });
  return { mean: d.reduce(function (s, x) {
    return s + x;
  }, 0) / d.length, max: Math.max(...d), n: d.length };
}

test("source points: normalized image points times the video size, visibility kept; OpenPose from them", async function () {
  const { v } = await setup();
  const r = v.srcPoints(PERSON, VIDEO[0], VIDEO[1], 0.3);
  assert.strictEqual(r.mp.length, 33);
  assert.deepStrictEqual(r.mp[0], [0.4933 * 1024, 0.1238 * 1536, 1]);
  assert.strictEqual(r.op.length, 18);
  assert.deepStrictEqual(r.op[0], r.mp[0]);
});

test("POV: shared joints sit on the same pixel in both layers; neck = middle of the shoulders", async function () {
  const { v, pov } = await setup({ yaw: 35 });
  const r = v.povPoints(PERSON, pov, SIZE, CFG);
  MP_OF_OP.forEach(function (m, j) {
    if (m >= 0 && r.op[j][2] > 0) {
      assert.deepStrictEqual(r.op[j].slice(0, 2), r.mp[m].slice(0, 2), `OP ${j}`);
    }
  });
  const mid = [(r.mp[11][0] + r.mp[12][0]) / 2, (r.mp[11][1] + r.mp[12][1]) / 2];
  assert.ok(Math.abs(r.op[1][0] - mid[0]) < 1e-9 && Math.abs(r.op[1][1] - mid[1]) < 1e-9, "neck");
});

test("POV fit: the visible OpenPose joints sit inside the margins, touching top and bottom", async function () {
  const { v, pov } = await setup();
  const r = v.povPoints(PERSON, pov, SIZE, CFG);
  const vis = r.op.filter(function (p) {
    return p[2] > 0;
  });
  const ys = vis.map(function (p) {
    return p[1];
  });
  const xs = vis.map(function (p) {
    return p[0];
  });
  assert.ok(Math.abs(Math.min(...ys) - 121.6) < 1e-6, "top");
  assert.ok(Math.abs(Math.max(...ys) - (1216 - 109.44)) < 1e-6, "bottom");
  assert.ok(Math.min(...xs) >= 41.6 - 1e-6 && Math.max(...xs) <= 832 - 41.6 + 1e-6, "sides");
});

test("yaw 0 with the eye at the target height ~ the source skeleton after the same fit", async function () {
  const { s, v } = await setup();
  const W = (await load("zk_camera.js")).toYUp(PERSON.world);
  const chest = (W[11][1] + W[12][1]) / 2;
  const floor = Math.min(...W.map(function (p) {
    return p[1];
  }));
  const pov = s.setCamera(s.povDefaults(CFG), { eyeHeight: chest - floor, distance: 3 }, CFG);
  const a = v.povPoints(PERSON, pov, SIZE, CFG).op;
  const fr = await load("zk_framing.js");
  const src = v.srcPoints(PERSON, VIDEO[0], VIDEO[1], 0.3);
  const b = fr.frame(src, "fit", SIZE, pov.margins).op;
  const d = diff(a, b, false);
  assert.strictEqual(d.n, 18);
  assert.ok(d.mean < 0.03 && d.max < 0.06, JSON.stringify(d));
});

test("yaw 180 = the mirror of yaw 0 with depth reversed, and the person's own sides swap image sides", async function () {
  const { s, v } = await setup();
  const front = v.povPoints(PERSON, s.povDefaults(CFG), SIZE, CFG).op;
  const back = v.povPoints(PERSON, s.applyPreset(s.povDefaults(CFG), "back", CFG), SIZE, CFG).op;
  for (const [r, l] of PAIRS) {
    assert.ok(front[l][0] > front[r][0], `front: left ${l} right of ${r}`);
    assert.ok(back[l][0] < back[r][0], `back: left ${l} left of ${r}`);
  }
  // Exact check: the back view = the front view of the same pose with depth reversed around the target, mirrored.
  const tz = (PERSON.world[11][2] + PERSON.world[12][2]) / 2;
  const flipped = { image: PERSON.image, world: PERSON.world.map(function (p) {
    return [p[0], p[1], 2 * tz - p[2]];
  }) };
  const mirror = v.povPoints(flipped, s.povDefaults(CFG), SIZE, CFG).op;
  const d = diff(mirror, back, true);
  assert.ok(d.max < 1e-9, JSON.stringify(d));
});

test("true camera: plain projection, the chest target within 3 px of the image centre", async function () {
  const { s, v } = await setup();
  const pov = s.setOptions(s.povDefaults(CFG), { framing: "true" }, CFG);
  const r = v.povPoints(PERSON, pov, SIZE, CFG);
  const mid = [(r.mp[11][0] + r.mp[12][0]) / 2, (r.mp[11][1] + r.mp[12][1]) / 2];
  assert.ok(Math.abs(mid[0] - 416) < 3 && Math.abs(mid[1] - 608) < 3, String(mid));
});

test("a joint behind the POV eye is hidden in both layers ([0, 0, 0]), the others stay", async function () {
  const { v, pov } = await setup();
  const world = PERSON.world.map(function (p, i) {
    return i === 0 ? [p[0], p[1], -5] : p;
  });
  const s = await load("zk_povstate.js");
  const r = v.povPoints({ image: PERSON.image, world }, s.setOptions(pov, { depth: 1 }, CFG), SIZE, CFG);
  assert.deepStrictEqual(r.mp[0], [0, 0, 0]);
  assert.deepStrictEqual(r.op[0], [0, 0, 0]);
  assert.ok(r.mp[11][2] > 0 && r.op[5][2] > 0);
});

test("people kept as a list: povPoints takes one person object, the pose keeps every person", async function () {
  const { v, pov } = await setup();
  const r = v.povPoints({ image: PERSON.image, world: PERSON.world }, pov, SIZE, CFG);
  assert.strictEqual(r.mp.length, 33);
  assert.ok(r.eye.length === 3 && r.target.length === 3);
});

const FACE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "front_pose_face.json"), "utf8"));

test("face: source layer = 478 points x frame size + OpenPose face 70; no face -> no face layer", async function () {
  const { v } = await setup();
  const r = v.srcPoints(FACE.person, FACE.width, FACE.height, 0.3);
  assert.strictEqual(r.face.mp.length, 478);
  assert.strictEqual(r.face.op.length, 70);
  assert.deepStrictEqual(r.face.mp[1].slice(0, 2), [FACE.person.face.image[1][0] * 1024, FACE.person.face.image[1][1] * 1536]);
  assert.strictEqual(v.srcPoints(PERSON, VIDEO[0], VIDEO[1], 0.3).face, null);
});

function faceSetup(s, camera) {
  return s.setCamera(s.povDefaults(CFG), { distance: 3, eyeHeight: 1.3, ...camera }, CFG);
}

test("face POV yaw 0: same shape as the source face after the body's fit (front check, < 1.5 % of the height)", async function () {
  const { s, v } = await setup();
  const fr = await load("zk_framing.js");
  const r = v.povPoints(FACE.person, faceSetup(s, {}), SIZE, CFG);
  const src = v.srcPoints(FACE.person, FACE.width, FACE.height, 0.3);
  const tr = fr.fitTransform(src.op, SIZE, CFG.pov.margins);
  const d = diff(r.face.op, fr.applyTransform(src.face.op, tr), false);
  assert.strictEqual(d.n, 70);
  assert.ok(d.mean < 0.015 && d.max < 0.02, JSON.stringify(d));
});

test("face POV side (yaw 90 / -90): the near half shows, the far cheek is hidden (side check)", async function () {
  const { s, v } = await setup();
  const left = v.povPoints(FACE.person, faceSetup(s, { yaw: 90 }), SIZE, CFG).face.mp;
  const right = v.povPoints(FACE.person, faceSetup(s, { yaw: -90 }), SIZE, CFG).face.mp;
  for (const mp of [left, right]) {
    const n = mp.filter(function (p) {
      return p[2] > 0;
    }).length;
    assert.ok(n > 478 * 0.3 && n < 478 * 0.7, String(n));
  }
  assert.deepStrictEqual([left[454][2], left[234][2], right[234][2], right[454][2]], [1, 0, 1, 0]);
});

test("face POV from behind (yaw 135, 180): hidden as a whole", async function () {
  const { s, v } = await setup();
  for (const yaw of [135, 180]) {
    const f = v.povPoints(FACE.person, faceSetup(s, { yaw }), SIZE, CFG).face;
    assert.ok(f.mp.every(function (p) {
      return p[2] === 0;
    }) && f.op.every(function (p) {
      return p[2] === 0;
    }), String(yaw));
  }
});
