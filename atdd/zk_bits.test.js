// Unit tests for web/js/zk_bits.js (frame number drawn as 16 squares in zkroto_test_2997.mp4).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_bits.js")).href;
const SPEC = { x0: 20, step: 76, y: 620, size: 56, bits: 16, threshold: 128 };

function load() {
  return import(MODULE);
}

function meansFor(n, bits) {
  const out = [];
  for (let k = 0; k < bits; k += 1) {
    out.push((n >> k) & 1 ? 255 : 0);
  }
  return out;
}

test("bitCenters: 16 squares, centre of square k at x0 + k * step + size / 2", async function () {
  const b = await load();
  const c = b.bitCenters(SPEC);
  assert.strictEqual(c.length, 16);
  assert.deepStrictEqual(c[0], [48, 648]);
  assert.deepStrictEqual(c[1], [124, 648]);
  assert.deepStrictEqual(c[15], [1188, 648]);
});

test("meanBrightness averages r, g, b over RGBA pixels", async function () {
  const b = await load();
  const data = Uint8ClampedArray.from([255, 255, 255, 255, 0, 0, 0, 255]);
  assert.strictEqual(b.meanBrightness(data), 127.5);
});

test("decodeBits turns square brightness into the frame number", async function () {
  const b = await load();
  for (const n of [0, 1, 123, 299, 65535]) {
    assert.strictEqual(b.decodeBits(meansFor(n, 16), SPEC.threshold), n, `frame ${n}`);
  }
});

test("decodeBits threshold is strict: exactly 128 reads as 0", async function () {
  const b = await load();
  const means = meansFor(0, 16);
  means[0] = 128;
  means[1] = 128.5;
  assert.strictEqual(b.decodeBits(means, SPEC.threshold), 2);
});
