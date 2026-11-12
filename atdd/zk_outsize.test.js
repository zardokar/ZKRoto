// Unit tests for web/js/zk_outsize.js (Portrait / Landscape 832 x 1216, Custom rounded to x64 with a 1 MP warning).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_outsize.js")).href;
const CFG = { portrait: [832, 1216], custom: { step: 64, min: 64, max: 4096, targetPixels: 1048576, warnFraction: 0.15 } };

function load() {
  return import(MODULE);
}

test("portrait = 832 x 1216, landscape = 1216 x 832, never a warning", async function () {
  const o = await load();
  assert.deepStrictEqual(o.outSize("portrait", null, CFG), { width: 832, height: 1216, warn: false });
  assert.deepStrictEqual(o.outSize("landscape", null, CFG), { width: 1216, height: 832, warn: false });
});

test("custom rounds each side to a multiple of 64: 833 -> 832, 1210 -> 1216", async function () {
  const o = await load();
  const s = o.outSize("custom", [833, 1210], CFG);
  assert.strictEqual(s.width, 832);
  assert.strictEqual(s.height, 1216);
  assert.strictEqual(s.warn, false);
});

test("custom far from 1 MP warns (more than 15 %), near does not; limits 64 .. 4096", async function () {
  const o = await load();
  assert.strictEqual(o.outSize("custom", [512, 512], CFG).warn, true);
  assert.strictEqual(o.outSize("custom", [1024, 1024], CFG).warn, false);
  assert.strictEqual(o.outSize("custom", [1536, 1024], CFG).warn, true);
  assert.deepStrictEqual(o.outSize("custom", [10, 99999], CFG).width, 64);
  assert.deepStrictEqual(o.outSize("custom", [10, 99999], CFG).height, 4096);
});

test("pixelOff gives the distance from 1 MP in percent (one decimal)", async function () {
  const o = await load();
  assert.strictEqual(o.pixelOff(512, 512, CFG), 75);
  assert.strictEqual(o.pixelOff(832, 1216, CFG), 3.5);
});

test("unknown mode falls back to portrait", async function () {
  const o = await load();
  assert.deepStrictEqual(o.outSize("square", null, CFG), { width: 832, height: 1216, warn: false });
});
