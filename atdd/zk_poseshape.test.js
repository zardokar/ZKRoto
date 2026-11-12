// Unit tests for web/js/zk_poseshape.js (pose engine result -> plain arrays) and web/js/zk_text.js (message templates).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const JS = path.join(__dirname, "..", "web", "js");

function load(name) {
  return import(pathToFileURL(path.join(JS, name)).href);
}

test("round4 keeps 4 decimals", async function () {
  const p = await load("zk_poseshape.js");
  assert.strictEqual(p.round4(0.123456), 0.1235);
  assert.strictEqual(p.round4(-1.72704), -1.727);
});

test("shapePose: image [x, y, z, vis], world [x, y, z], ms rounded, missing visibility = 0, missing world = []", async function () {
  const p = await load("zk_poseshape.js");
  const result = {
    landmarks: [[{ x: 0.49331, y: 0.12384, z: -1.72704, visibility: 0.99996 }], [{ x: 0.1, y: 0.2, z: 0.3 }]],
    worldLandmarks: [[{ x: 0.00721, y: -0.47164, z: -0.51512 }]],
  };
  const shaped = p.shapePose(result, { frame: 10, width: 1024, height: 1536, ms: 55.6 });
  assert.deepStrictEqual(shaped, {
    frame: 10,
    width: 1024,
    height: 1536,
    ms: 56,
    people: [
      { image: [[0.4933, 0.1238, -1.727, 1]], world: [[0.0072, -0.4716, -0.5151]] },
      { image: [[0.1, 0.2, 0.3, 0]], world: [] },
    ],
  });
});

test("shapePose throws when the engine result has no worldLandmarks at all (same as 0.1.1)", async function () {
  const p = await load("zk_poseshape.js");
  const result = { landmarks: [[{ x: 0.1, y: 0.2, z: 0.3, visibility: 1 }]] };
  assert.throws(function () {
    p.shapePose(result, { frame: 0, width: 1, height: 1, ms: 1 });
  }, TypeError);
});

test("fmt fills {name} slots and leaves unknown slots as they are", async function () {
  const t = await load("zk_text.js");
  assert.strictEqual(t.fmt("loading {name}", { name: "a.mp4" }), "loading a.mp4");
  assert.strictEqual(t.fmt("pose: {n} person(s), {ms} ms", { n: 1, ms: 56 }), "pose: 1 person(s), 56 ms");
  assert.strictEqual(t.fmt("keep {x}", {}), "keep {x}");
});

test("swapPose exchanges person 1 and 2 and records it; one person: unchanged, not recorded", async function () {
  const p = await load("zk_poseshape.js");
  const pose = { frame: 3, width: 2, height: 2, ms: 1, people: [{ image: [1] }, { image: [2] }] };
  const once = p.swapPose(pose);
  assert.deepStrictEqual(once.people, [{ image: [2] }, { image: [1] }]);
  assert.strictEqual(once.swapped, true);
  assert.strictEqual(p.swapPose(once).swapped, false);
  assert.deepStrictEqual(pose.people[0], { image: [1] }, "input not changed");
  const single = p.swapPose({ people: [{ image: [1] }] });
  assert.deepStrictEqual(single.people, [{ image: [1] }]);
  assert.strictEqual(single.swapped, false);
});
