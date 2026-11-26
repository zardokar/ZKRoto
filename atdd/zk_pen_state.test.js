// Pen facade state after the second independent review (2026-11-24 13:2x): Delete while drawing, keys held when the
// window loses focus, a tool key during a Space pan, the view zoomed under a still mouse, and point edit mode (E).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { setup, ev, key } = require("./pen_kit.js");

test("Delete while drawing drops the open line and the next click starts a new one (no throw)", async function () {
  const { pen } = await setup();
  pen.tool("pen");
  pen.down(ev(10, 10));
  pen.up(ev(10, 10));
  pen.down(ev(100, 10));
  pen.up(ev(100, 10));
  pen.key(key("Delete"));
  assert.strictEqual(pen.doc().paths.length, 0);
  assert.strictEqual(pen.state().pen, null);
  pen.down(ev(50, 50));
  pen.up(ev(50, 50));
  assert.strictEqual(pen.doc().paths.length, 1);
  assert.strictEqual(pen.doc().paths[0].points.length, 1);
});

test("window blur lets go of Space, Alt and a pan in progress", async function () {
  const { pen } = await setup();
  pen.key(key("Space", { key: " " }));
  pen.down(ev(10, 10));
  assert.strictEqual(pen.cursor(), "hand_drag");
  pen.blur();
  assert.strictEqual(pen.cursor(), "select");
  pen.tool("zoom");
  pen.key(key("AltLeft", { key: "Alt", altKey: true }));
  assert.strictEqual(pen.cursor(), "zoom_out");
  pen.blur();
  assert.strictEqual(pen.cursor(), "zoom_in");
});

test("a tool key during a Space pan ends the pan (no pan after the button is up)", async function () {
  const { pen, calls } = await setup();
  pen.key(key("Space", { key: " " }));
  pen.down(ev(10, 10));
  pen.key(key("KeyP"));
  pen.up(ev(10, 10));
  const before = calls.length;
  pen.move(ev(60, 60));
  assert.strictEqual(calls.filter(function (c) {
    return c[0] === "pan";
  }).length, calls.slice(0, before).filter(function (c) {
    return c[0] === "pan";
  }).length);
  pen.keyUp(key("Space", { key: " " }));
  assert.strictEqual(pen.cursor(), "pen");
});

test("zoom or pan under a still mouse updates what the pen cursor says", async function () {
  const { pen, canvas, view } = await setup();
  pen.tool("pen");
  pen.down(ev(10, 10));
  pen.up(ev(10, 10));
  pen.down(ev(100, 10));
  pen.up(ev(100, 10));
  pen.key(key("Enter"));
  pen.move(ev(100, 10));
  assert.strictEqual(pen.cursor(), "pen_del");
  canvas.box = { left: -90, top: 20, width: 400, height: 300 };
  view.changed();
  assert.strictEqual(pen.cursor(), "pen");
});

test("point edit mode (E) on: pen keys are left alone, 0 still fits the view", async function () {
  const { pen, ctx, calls } = await setup();
  pen.tool("pen");
  pen.down(ev(10, 10));
  pen.up(ev(10, 10));
  pen.down(ev(100, 10));
  pen.up(ev(100, 10));
  pen.key(key("Enter"));
  ctx.state.editMode = true;
  assert.strictEqual(pen.key(key("KeyV")), false);
  assert.strictEqual(pen.tool(), "pen");
  assert.strictEqual(pen.key(key("Delete")), false);
  assert.strictEqual(pen.key(key("Space", { key: " " })), false);
  assert.strictEqual(pen.doc().paths.length, 1);
  assert.strictEqual(pen.key(key("Digit0")), true);
  assert.deepStrictEqual(calls[calls.length - 1], ["fit"]);
});

test("window blur in the middle of a drag drops the grab (the path does not follow a mouse with no button)", async function () {
  const { pen } = await setup();
  pen.tool("pen");
  pen.down(ev(10, 10));
  pen.up(ev(10, 10));
  pen.down(ev(100, 10));
  pen.up(ev(100, 10));
  pen.key(key("Enter"));
  pen.tool("point");
  pen.down(ev(100, 10));
  pen.blur();
  pen.move(ev(150, 80));
  pen.up(ev(150, 80));
  pen.move(ev(200, 120));
  const p = pen.doc().paths[0].points[1];
  assert.deepStrictEqual([p.x, p.y], [200, 20]);
});

test("a press on the picture takes the focus back from a field, so 0 and the tool keys work again (cvKeysTakeFocus)",
  async function () {
    const { pen } = await setup();
    let blurred = 0;
    const before = globalThis.document;
    globalThis.document = { activeElement: { tagName: "INPUT", blur: function () {
      blurred += 1;
    } } };
    try {
      pen.down(ev(10, 10));
      pen.up(ev(10, 10));
    } finally {
      globalThis.document = before;
    }
    assert.strictEqual(blurred, 1);
  });

test("page cursor mode: the system cursor is hidden over the pen and every cursor change is told to the page",
  async function () {
    const { pen, canvas } = await setup();
    const told = [];
    pen.softCursor(function (name) {
      told.push(name);
    });
    assert.strictEqual(canvas.style.cursor, "none");
    pen.tool("zoom");
    pen.key(key("AltLeft", { key: "Alt", altKey: true }));
    assert.deepStrictEqual(told.slice(-2), ["zoom_in", "zoom_out"]);
  });

test("review 13:3x: pointercancel during a transform puts the shape back; Delete during a drag leaves no stale grab",
  async function () {
    const { pen } = await setup();
    pen.tool("pen");
    for (const [x, y] of [[10, 10], [100, 10], [55, 80]]) {
      pen.down(ev(x, y));
      pen.up(ev(x, y));
    }
    pen.key(key("Enter"));
    pen.tool("select");
    const before = JSON.stringify(pen.doc().paths[0].points);
    pen.down(ev(100, 80));
    pen.move(ev(150, 100));
    pen.cancel(ev(150, 100));
    assert.strictEqual(JSON.stringify(pen.doc().paths[0].points), before);
    pen.down(ev(100, 80));
    pen.move(ev(150, 100));
    pen.key(key("Delete"));
    assert.strictEqual(pen.state().grab, null);
  });
