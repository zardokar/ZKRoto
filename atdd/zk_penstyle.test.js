// Fill / Stroke box rules (canvas module cv_color.js, cv_style.js, cv_cmdmake.js cvMakeSwap; docs/cv_color.js.md,
// docs/cv_style.js.md): one colour goes to the front square and, when a shape is chosen, to that shape; X swaps the
// two squares and the chosen shape's colours; / = no colour; a new shape never gets stroke "none" (rule 24).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_penstyle.js")).href;
const LOOK = { fill: "#8a8a92", stroke: "#ececee", strokeWidth: 2 };

function doc() {
  return { version: 1, seq: 1, paths: [{ id: "p1", kind: "poly", closed: false, fill: "none", stroke: "#111111",
    stroke_width: 2, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] }] };
}

test("start: fill in front, the canvas default colours; a new shape gets fill + stroke from the box", async function () {
  const S = await import(MODULE);
  const style = S.newStyle(LOOK);
  assert.deepStrictEqual(style, { fill: "#8a8a92", stroke: "#ececee", front: "fill", fillOp: 1, strokeOp: 1 });
  assert.deepStrictEqual(S.shapeStyle(style, LOOK), { fill: "#8a8a92", stroke: "#ececee", stroke_width: 2 });
});

test("Koh 14:21: a new shape takes stroke None by default (replaces canvas rule 24); a chosen stroke colour still " +
  "goes to new shapes", async function () {
  const S = await import(MODULE);
  const none = { fill: "#8a8a92", stroke: "none", strokeWidth: 2 };
  const style = S.newStyle(none);
  assert.strictEqual(style.stroke, "none");
  assert.strictEqual(S.shapeStyle(style, none).stroke, "none");
  style.stroke = "#112233";
  assert.strictEqual(S.shapeStyle(style, none).stroke, "#112233");
});

test("a colour goes to the front square, and to the chosen shape; a fill closes the shape (#140)", async function () {
  const S = await import(MODULE);
  const d = doc();
  const style = S.newStyle(LOOK);
  assert.strictEqual(S.applyColor(style, d, "p1", "#AA0000"), true);
  assert.strictEqual(style.fill, "#aa0000");
  assert.strictEqual(d.paths[0].fill, "#aa0000");
  assert.strictEqual(d.paths[0].closed, true);
  S.setFront(style, "stroke");
  S.applyColor(style, d, null, "#00ff00");
  assert.strictEqual(style.stroke, "#00ff00");
  assert.strictEqual(d.paths[0].stroke, "#111111", "nothing chosen = only the box");
  assert.strictEqual(S.applyColor(style, d, "p1", "#12"), false, "bad hex refused (same rule as the file)");
});

test("/ = no colour for the front square; X swaps the squares and the chosen shape's colours at once",
  async function () {
    const S = await import(MODULE);
    const d = doc();
    const style = S.newStyle(LOOK);
    S.applyColor(style, d, "p1", "none");
    assert.strictEqual(d.paths[0].fill, "none");
    assert.strictEqual(d.paths[0].closed, false, "no fill keeps the shape as it was");
    S.fromPath(style, d.paths[0]);
    assert.deepStrictEqual([style.fill, style.stroke], ["none", "#111111"]);
    S.swap(style, d, "p1");
    assert.deepStrictEqual([style.fill, style.stroke], ["#111111", "none"]);
    assert.deepStrictEqual([d.paths[0].fill, d.paths[0].stroke], ["#111111", "none"]);
  });

test("opacity belongs to the square (fill and stroke apart); full = no key on the shape", async function () {
  const S = await import(MODULE);
  const d = doc();
  const style = S.newStyle(LOOK);
  S.setOpacity(style, d, "p1", 0.4);
  assert.strictEqual(d.paths[0].fill_opacity, 0.4);
  assert.strictEqual(S.opacityOf(style), 0.4);
  S.setOpacity(style, d, "p1", 7);
  assert.strictEqual(d.paths[0].fill_opacity, undefined, "clamped to 1 = no key");
  S.setFront(style, "stroke");
  assert.strictEqual(S.colorOf(style), "#ececee");
  assert.strictEqual(S.opacityOf(style), 1);
});
