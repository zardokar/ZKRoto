// Fill / Stroke through the pen facade (canvas cv_color.js, cv_key_edit.js x and /, cv_tool_view.js eyedrop I):
// a new shape takes fill + stroke from the box (Koh voice 13:4x: draw fill and stroke, fill first); X swaps; /
// clears the front square; choosing a shape shows its colours; I samples the picture into the front square.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { CFG, setup, ev, key } = require("./pen_kit.js");

function draw(pen) {
  pen.tool("pen");
  pen.down(ev(10, 10));
  pen.up(ev(10, 10));
  pen.down(ev(100, 10));
  pen.up(ev(100, 10));
  pen.down(ev(100, 80));
  pen.up(ev(100, 80));
  pen.key(key("Enter"));
  return pen.doc().paths[0];
}

test("a new shape gets the box: fill (front) and stroke from config, canvas defaults", async function () {
  const { pen } = await setup();
  const p = draw(pen);
  assert.strictEqual(CFG.pen.fill, "#8a8a92");
  assert.strictEqual(CFG.pen.stroke, "none", "Koh 14:21: stroke None by default");
  assert.deepStrictEqual([p.fill, p.stroke, p.stroke_width], ["#8a8a92", "none", CFG.pen.strokeWidth]);
  assert.strictEqual(pen.color.style().front, "fill");
});

test("a colour goes to the chosen shape; X swaps fill and stroke; / clears the front square", async function () {
  const { pen, ctx } = await setup();
  const seen = [];
  ctx.bus.on("zk:color", function (s) {
    seen.push(s.fill);
  });
  const p = draw(pen);
  pen.color.apply("#ff0000");
  assert.strictEqual(p.fill, "#ff0000");
  pen.key(key("KeyX"));
  assert.deepStrictEqual([p.fill, p.stroke], ["none", "#ff0000"], "stroke None (default) comes to the fill");
  pen.key(key("KeyX"));
  pen.key(key("Slash", { key: "/" }));
  assert.strictEqual(p.fill, "none");
  assert.ok(seen.length >= 3, "the box hears every change");
});

test("choosing a shape with V shows its colours in the box", async function () {
  const { pen } = await setup();
  const p = draw(pen);
  p.fill = "#00ff00";
  pen.key(key("Escape"));
  pen.tool("select");
  pen.down(ev(55, 10));
  pen.up(ev(55, 10));
  assert.strictEqual(pen.state().selected, p.id);
  assert.strictEqual(pen.color.style().fill, "#00ff00");
});

test("I = eyedropper: a click samples the picture under it into the front square (and the chosen shape)",
  async function () {
    const { pen, calls } = await setup();
    const p = draw(pen);
    pen.key(key("KeyI"));
    assert.strictEqual(pen.tool(), "eyedrop");
    assert.strictEqual(pen.cursor(), "eyedrop");
    pen.down(ev(40, 30));
    pen.up(ev(40, 30));
    assert.deepStrictEqual(calls.filter((c) => c[0] === "sample"), [["sample", 80, 60]]);
    assert.strictEqual(pen.color.style().fill, "#123456");
    assert.strictEqual(p.fill, "#123456");
    assert.ok(CFG.pen.tools.includes("eyedrop"));
  });
