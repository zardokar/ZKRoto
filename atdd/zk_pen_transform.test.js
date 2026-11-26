// V transform through the pen facade (canvas cv_tool_transform.js, cv_key_edit.js cvKeyEscape, cv_tools.js tool
// switch): drag a corner of the chosen shape to resize it, the opposite corner stays; Esc, a tool key or a lost
// window during the drag put the shape back. Koh voice 2026-11-24 13:4x: "สเกล ทรานส์ฟอร์ม ... ยืดหด".
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { CFG, setup, ev, key } = require("./pen_kit.js");

async function shape() {
  const s = await setup();
  s.pen.tool("pen");
  for (const [x, y] of [[10, 10], [100, 10], [55, 80]]) {
    s.pen.down(ev(x, y));
    s.pen.up(ev(x, y));
  }
  s.pen.key(key("Enter"));
  s.pen.tool("select");
  s.pts = () => JSON.stringify(s.pen.doc().paths[0].points);
  return s;
}

test("config carries the canvas transform settings", function () {
  assert.deepStrictEqual([CFG.pen.transformHitPx, CFG.pen.transformRotatePx, CFG.pen.transformHandlePx,
    CFG.pen.transformSnapDegrees, CFG.pen.transformMinSize], [8, 28, 5, 15, 0.01]);
});

test("V on the chosen shape: drag the bottom right corner = resize, the top left corner stays", async function () {
  const { pen } = await shape();
  pen.down(ev(100, 80));
  pen.move(ev(150, 100));
  pen.up(ev(150, 100));
  const p = pen.doc().paths[0].points;
  assert.deepStrictEqual([p[0].x, p[0].y], [20, 20]);
  assert.ok(Math.abs(p[1].x - 300) < 1e-9, "x stretched to the new right edge");
});

test("Esc, a tool key or a lost window during the drag put the shape back", async function () {
  for (const stop of [(pen) => pen.key(key("Escape")), (pen) => pen.key(key("KeyA")), (pen) => pen.blur()]) {
    const { pen, pts } = await shape();
    const original = pts();
    pen.down(ev(100, 80));
    pen.move(ev(150, 100));
    stop(pen);
    assert.strictEqual(pts(), original);
    pen.move(ev(170, 120));
    assert.strictEqual(pts(), original, "nothing follows the mouse afterwards");
  }
});
