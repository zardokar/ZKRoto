// Pen cursors (web/js/zk_pencursor.js) = the canvas module's cursor table (cv_cursor.js, atdd/js/test_cv_cursor.js):
// tool + what is under the mouse + keys held -> icon name; icons from web/constants/cursors.json (Koh's canvas set).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_pencursor.js")).href;
const ICONS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "constants", "cursors.json"), "utf8"));

function mods(extra) {
  return Object.assign({ alt: false, space: false, dragging: false }, extra || {});
}

test("table: select = filled arrow (also with Alt), point = hollow arrow, zoom = magnifier + / - with Alt", async function () {
  const { cursorFor } = await import(MODULE);
  assert.strictEqual(cursorFor("select", null, mods()), "select");
  assert.strictEqual(cursorFor("select", null, mods({ alt: true })), "select");
  assert.strictEqual(cursorFor("point", null, mods()), "point");
  assert.strictEqual(cursorFor("zoom", null, mods()), "zoom_in");
  assert.strictEqual(cursorFor("zoom", null, mods({ alt: true })), "zoom_out");
  assert.strictEqual(cursorFor("fill", null, mods()), null);
});

test("pen: empty = pen, on a line = pen_add, on a point = pen_del, + Alt = pen_curve, first point = pen_close",
  async function () {
    const { cursorFor } = await import(MODULE);
    assert.strictEqual(cursorFor("pen", null, mods()), "pen");
    assert.strictEqual(cursorFor("pen", "segment", mods()), "pen_add");
    assert.strictEqual(cursorFor("pen", "point", mods()), "pen_del");
    assert.strictEqual(cursorFor("pen", "point", mods({ alt: true })), "pen_curve");
    assert.strictEqual(cursorFor("pen", "first", mods()), "pen_close");
  });

test("Space = open hand over any tool, closed hand while dragging; the pan tool itself = hand", async function () {
  const { cursorFor } = await import(MODULE);
  assert.strictEqual(cursorFor("pen", "point", mods({ space: true })), "hand_open");
  assert.strictEqual(cursorFor("pen", null, mods({ space: true, dragging: true })), "hand_drag");
  assert.strictEqual(cursorFor("pan", null, mods()), "hand_open");
  assert.strictEqual(cursorFor("pan", null, mods({ dragging: true })), "hand_drag");
});

test("every icon name the table uses exists in cursors.json with a data-URI and a hot spot; css() falls back",
  async function () {
    const { cursorCss } = await import(MODULE);
    for (const name of ["select", "point", "pen", "pen_add", "pen_del", "pen_curve", "pen_close", "zoom_in", "zoom_out",
      "hand_open", "hand_drag"]) {
      const icon = ICONS[name];
      assert.ok(icon && icon.uri.startsWith("data:image/svg+xml,"), name);
      assert.strictEqual(typeof icon.hx, "number", name);
    }
    assert.match(cursorCss(ICONS, "pen", "crosshair"), /^url\("data:image\/svg\+xml,.*"\) 3 13, crosshair$/);
    assert.strictEqual(cursorCss(ICONS, "nothing", "crosshair"), "crosshair");
  });

test("contrast (Koh 13:57: the cursor merged into some colours): the cursor splits into a dark edge (no fill) and " +
  "the white ink alone; the page shows the ink inverted against the picture under it", async function () {
  const { splitCursor } = await import(MODULE);
  const parts = splitCursor(ICONS.pen);
  const edge = decodeURIComponent(parts.edge.uri.replace("data:image/svg+xml,", ""));
  const ink = decodeURIComponent(parts.ink.uri.replace("data:image/svg+xml,", ""));
  assert.ok(!edge.includes('fill="#ffffff"') && !edge.includes('fill="#000000"'), "edge: outline only");
  assert.ok(edge.includes('stroke="#000000"'));
  assert.ok(!ink.includes('stroke="#000000"') && ink.includes('<g fill="#ffffff" stroke="#ffffff">'), "ink only");
  assert.deepStrictEqual([parts.ink.hx, parts.ink.hy], [ICONS.pen.hx, ICONS.pen.hy]);
  const css = fs.readFileSync(path.join(__dirname, "..", "web", "layout", "zk_page.css"), "utf8");
  assert.match(css, /\.zk-softink\s*\{[^}]*mix-blend-mode: difference/);
  assert.match(css, /#pen\s*\{[^}]*width: 100%;[^}]*height: 100%;/, "the pen canvas covers the pane (sharp drawing)");
});
