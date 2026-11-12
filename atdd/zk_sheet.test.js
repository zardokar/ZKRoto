// Character sheet body (user choice 2026-11-10, option 2): x / y from the front picture, depth from the side picture.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const FRONT = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "front_pose_face.json"), "utf8"));
const SIDE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "side_pose.json"), "utf8"));

function load() {
  return import(pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_sheet.js")).href);
}

function mirror(person) {
  return { ...person, image: person.image.map(function (p) {
    return [1 - p[0], p[1], p[2], p[3]];
  }) };
}

test("facing: FRA-007 side.png looks left; mirrored it looks right", async function () {
  const { facing } = await load();
  assert.strictEqual(facing(SIDE.person), -1);
  assert.strictEqual(facing(mirror(SIDE.person)), 1);
});

test("sheetWorld: the nose is in front of the hips (negative z) whichever way the side picture faces", async function () {
  const { sheetWorld } = await load();
  for (const side of [SIDE.person, mirror(SIDE.person)]) {
    const w = sheetWorld(FRONT.person, FRONT.width, FRONT.height, side, SIDE.width, SIDE.height);
    assert.ok(w[0][2] < -0.05, JSON.stringify(w[0]));
    assert.ok(Math.abs((w[23][2] + w[24][2]) / 2) < 1e-9);
  }
});

test("sheetWorld: x / y come from the front picture (hips at 0), unchanged by the side picture", async function () {
  const { sheetWorld } = await load();
  const a = sheetWorld(FRONT.person, FRONT.width, FRONT.height, SIDE.person, SIDE.width, SIDE.height);
  const b = sheetWorld(FRONT.person, FRONT.width, FRONT.height, mirror(SIDE.person), SIDE.width, SIDE.height);
  a.forEach(function (p, i) {
    assert.strictEqual(p[0], b[i][0]);
    assert.strictEqual(p[1], b[i][1]);
  });
  assert.ok(a[0][1] < -0.4, "nose above the hips");
});
