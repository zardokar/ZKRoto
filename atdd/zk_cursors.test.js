// Cursor pictures (Koh 2026-11-24 13:47: "ปัญหามันแค่ cursor มันใหญ่ และหนาไป"): the canvas module's drawings
// (dev/cursors_canvas.json) drawn at 16 px instead of 24 with a thinner edge and thinner ink, hot spots scaled.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { build, SIZE, FROM_PX } = require("../dev/build_cursors.js");

const FILE = path.join(__dirname, "..", "web", "constants", "cursors.json");
const SRC = path.join(__dirname, "..", "dev", "cursors_canvas.json");

function svgOf(c) {
  return decodeURIComponent(c.uri.replace("data:image/svg+xml,", ""));
}

test("cursors.json is exactly what dev/build_cursors.js makes from the canvas drawings", function () {
  assert.strictEqual(fs.readFileSync(FILE, "utf8"), build());
});

test("every canvas cursor is there, drawn at 16 px (was 24), same drawing, hot spot scaled", function () {
  const now = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const was = JSON.parse(fs.readFileSync(SRC, "utf8"));
  assert.strictEqual(SIZE, 16);
  assert.deepStrictEqual(Object.keys(now), Object.keys(was));
  for (const name of Object.keys(was)) {
    const svg = svgOf(now[name]);
    assert.match(svg, /width="16" height="16"/, name);
    const pathsNow = svg.match(/ d="[^"]+"/g) || [];
    const pathsWas = svgOf(was[name]).match(/ d="[^"]+"/g) || [];
    assert.deepStrictEqual(pathsNow, pathsWas, name + " drawing unchanged");
    assert.strictEqual(now[name].hx, Math.round(was[name].hx * SIZE / FROM_PX), name);
    assert.strictEqual(now[name].hy, Math.round(was[name].hy * SIZE / FROM_PX), name);
  }
});

test("thinner: the dark edge and the ink lines are narrower than in the canvas file", function () {
  const now = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const was = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const edge = (c) => Number(svgOf(c).match(/<g fill="#000000" stroke="#000000" stroke-width="([\d.]+)"/)[1]);
  assert.ok(edge(now.pen) < edge(was.pen));
  const ink = (c) => Number(svgOf(c).split('<g fill="#ffffff" stroke="#ffffff">')[1].match(/stroke-width="([\d.]+)"/)[1]);
  assert.ok(ink(now.pen) < ink(was.pen));
});

test("the zoom cursors get a margin so the lens is not cut at 16 px (Koh 14:19: the zoom cursor looked strange)",
  function () {
    const now = JSON.parse(fs.readFileSync(FILE, "utf8"));
    for (const name of ["zoom", "zoom_in", "zoom_out"]) {
      assert.match(svgOf(now[name]), /viewBox="-[\d.]+ -[\d.]+ [\d.]+ [\d.]+"/, name);
    }
    assert.match(svgOf(now.pen), /viewBox="0 0 /, "others unchanged");
  });
