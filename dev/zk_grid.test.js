// Tests of dev/zk_grid.js (grid check: same cell / one cell off / further, with the direction).
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const g = require("./zk_grid");

const SIZE = [1024, 1536];
const GRID = { cols: 20, rows: 30 };

test("cellOf: 20 x 30 grid on 1024 x 1536 = 51.2 px cells; edges clamp", function () {
  assert.deepEqual(g.cellOf([0, 0], SIZE, GRID), [0, 0]);
  assert.deepEqual(g.cellOf([51.1, 51.3], SIZE, GRID), [0, 1]);
  assert.deepEqual(g.cellOf([1024, 1536], SIZE, GRID), [19, 29]);
  assert.deepEqual(g.cellOf([-5, 2000], SIZE, GRID), [0, 29]);
});

test("compareGrid: same cell / near (1 cell) / far, direction words, hidden points skipped", function () {
  const real = [[10, 10, 1], [100, 100, 1], [500, 500, 1], [9, 9, 0]];
  const ours = [[20, 20, 1], [130, 100, 1], [500, 300, 1], [9, 9, 1]];
  const out = g.compareGrid(real, ours, ["a", "b", "c", "d"], SIZE, GRID);
  assert.deepEqual(out.joints.map(function (j) {
    return [j.name, j.verdict, j.off];
  }), [["a", "same", ""], ["b", "near", "right 1"], ["c", "far", "up 4"]]);
  assert.deepEqual(out.summary, { n: 3, same: 1, near: 1, far: 1, worst: "c up 4" });
});

test("direction lists up / down first, then left / right", function () {
  assert.equal(g.direction(-2, 3), "down 3, left 2");
  assert.equal(g.direction(0, 0), "");
});
