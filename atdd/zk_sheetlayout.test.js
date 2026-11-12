// Unit tests for web/js/zk_sheetlayout.js (grid of the MediaPipe sheet: order, tile count, labels).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_sheetlayout.js")).href;
const CFG = { columns: 4, tileWidth: 200, labelHeight: 20, gap: 4 };

function load() {
  return import(MODULE);
}

test("tiles in frame order with the frame number as label, one tile per frame, duplicates removed", async function () {
  const s = await load();
  const out = s.sheetLayout([125, 120, 123, 120], [832, 1216], CFG, 6);
  assert.deepStrictEqual(out.tiles.map(function (t) {
    return t.frame;
  }), [120, 123, 125]);
  assert.deepStrictEqual(out.tiles.map(function (t) {
    return t.label;
  }), ["f000120", "f000123", "f000125"]);
});

test("tile size keeps the camera's aspect; grid of up to 'columns' per row", async function () {
  const s = await load();
  const out = s.sheetLayout([1, 2, 3, 4, 5, 6], [832, 1216], CFG, 6);
  const t = out.tiles[0];
  assert.strictEqual(t.w, 200);
  assert.strictEqual(t.h, 292);
  assert.deepStrictEqual([out.tiles[4].x, out.tiles[4].y], [4, 4 + 292 + 20 + 4]);
  assert.strictEqual(out.width, 4 + 4 * (200 + 4));
  assert.strictEqual(out.height, 4 + 2 * (292 + 20 + 4));
  assert.deepStrictEqual([t.lx, t.ly], [4 + 100, 4 + 292 + 10]);
});

test("fewer frames than columns: the sheet is only as wide as needed; no frames: no tiles, one empty cell", async function () {
  const s = await load();
  assert.strictEqual(s.sheetLayout([9, 10], [1216, 832], CFG, 6).width, 4 + 2 * 204);
  const empty = s.sheetLayout([], [832, 1216], CFG, 6);
  assert.strictEqual(empty.tiles.length, 0);
  assert.strictEqual(empty.width, 4 + 204);
});
