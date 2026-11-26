// Pen facade (web/js/zk_pen.js): the pen canvas over the picture, pointer -> zk_pentools, tolerances in screen
// pixels (canvas_config.json values) turned into canvas pixels, the chosen tool on the bus for the toolbar.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { CFG, setup, ev, key } = require("./pen_kit.js");

test("config carries the canvas module's tolerances and the tool order of the toolbar", function () {
  assert.deepStrictEqual(CFG.pen.tools, ["select", "point", "pen", "zoom", "eyedrop"], "CV_TOOL_ORDER");
  assert.strictEqual(CFG.pen.zoomClick, 1.6);
  assert.strictEqual(CFG.pen.zoomWheel, 1.12);
  assert.deepStrictEqual([CFG.pen.zoomMin, CFG.pen.zoomMax], [0.05, 40]);
  assert.strictEqual(CFG.pen.hitTolPx, 6);
  assert.strictEqual(CFG.pen.hitTolPointPx, 11);
  assert.strictEqual(CFG.pen.bezierDragPx, 4);
});

test("the tool starts as select (canvas default); a tool name tells the bus; null or an unknown name is ignored",
  async function () {
    const { pen, seen } = await setup();
    assert.strictEqual(pen.tool(), "select");
    assert.strictEqual(pen.tool("pen"), "pen");
    assert.strictEqual(pen.tool(null), "pen");
    assert.strictEqual(pen.tool("brush"), "pen");
    assert.deepStrictEqual(seen, ["pen"]);
  });

test("clicks with P make a path in canvas pixels (screen box is half size, so x2); Enter-finish keeps it open", async function () {
  const { pen } = await setup();
  pen.tool("pen");
  for (const [x, y] of [[10, 10], [100, 10], [100, 100]]) {
    pen.down(ev(x, y));
    pen.up(ev(x, y));
  }
  pen.key({ code: "Enter", key: "Enter", target: { tagName: "BODY" }, preventDefault: function () {
    return null;
  } });
  const doc = pen.doc();
  assert.strictEqual(doc.paths.length, 1);
  assert.deepStrictEqual(doc.paths[0].points.map(function (p) {
    return [p.x, p.y];
  }), [[20, 20], [200, 20], [200, 200]]);
  assert.strictEqual(doc.paths[0].closed, false);
  assert.strictEqual(pen.state().pen, null);
});

test("the cursor follows the tool and what is under the mouse (cv_cursor.js)", async function () {
  const { pen, canvas } = await setup();
  assert.match(canvas.style.cursor, /^url\("data:image\/svg\+xml,.*"\) 2 1, crosshair$/, "select arrow");
  pen.tool("pen");
  assert.match(canvas.style.cursor, /\) 3 13, crosshair$/, "pen");
  pen.down(ev(10, 10));
  pen.up(ev(10, 10));
  pen.down(ev(100, 10));
  pen.up(ev(100, 10));
  pen.move(ev(55, 10));
  assert.strictEqual(pen.cursor(), "pen_add", "over the line");
  pen.move(ev(100, 10));
  assert.strictEqual(pen.cursor(), "pen_del", "over a point");
  pen.move(ev(100, 10, { altKey: true }));
  assert.strictEqual(pen.cursor(), "pen_curve", "Alt over a point");
  pen.move(ev(100, 10));
  pen.tool("zoom");
  assert.strictEqual(pen.cursor(), "zoom_in");
  pen.key(key("AltLeft", { key: "Alt", altKey: true }));
  assert.strictEqual(pen.cursor(), "zoom_out", "Alt held = zoom out");
  pen.keyUp(key("AltLeft", { key: "Alt", altKey: false }));
  assert.strictEqual(pen.cursor(), "zoom_in");
});

test("clicking the first point closes the shape; V drags the whole path; switching tool finishes an open line",
  async function () {
    const { pen } = await setup();
    pen.tool("pen");
    for (const [x, y] of [[10, 10], [100, 10], [100, 100], [10, 10]]) {
      pen.down(ev(x, y));
      pen.up(ev(x, y));
    }
    assert.strictEqual(pen.doc().paths[0].closed, true);
    pen.tool("select");
    pen.down(ev(80, 30));
    pen.move(ev(90, 40));
    pen.up(ev(90, 40));
    assert.deepStrictEqual([pen.doc().paths[0].points[0].x, pen.doc().paths[0].points[0].y], [40, 40]);
    pen.tool("pen");
    pen.down(ev(150, 150));
    pen.up(ev(150, 150));
    pen.down(ev(180, 150));
    pen.up(ev(180, 150));
    pen.tool("point");
    assert.strictEqual(pen.state().pen, null);
    assert.strictEqual(pen.doc().paths.length, 2);
  });

test("drag with P less than bezierDragPx screen pixels stays a corner; more bends it (handles mirrored)", async function () {
  const { pen } = await setup();
  pen.tool("pen");
  pen.down(ev(10, 10));
  pen.up(ev(10, 10));
  pen.down(ev(100, 10));
  pen.move(ev(102, 10));
  assert.strictEqual(pen.doc().paths[0].kind, "poly", "2 screen px < 4");
  pen.move(ev(110, 10));
  pen.up(ev(110, 10));
  const p = pen.doc().paths[0].points[1];
  assert.strictEqual(pen.doc().paths[0].kind, "bezier");
  assert.deepStrictEqual([p.cx2, p.cy2], [180, 20]);
});

test("Delete removes the chosen path; Esc with no line open clears the selection, the tool stays", async function () {
  const { pen } = await setup();
  pen.tool("pen");
  pen.down(ev(10, 10));
  pen.up(ev(10, 10));
  pen.down(ev(100, 10));
  pen.up(ev(100, 10));
  const keyEv = function (code) {
    return { code, key: code, target: { tagName: "BODY" }, preventDefault: function () {
      return null;
    } };
  };
  pen.key(keyEv("Enter"));
  pen.tool("select");
  pen.down(ev(50, 10));
  pen.up(ev(50, 10));
  assert.strictEqual(pen.key(keyEv("Delete")), true);
  assert.strictEqual(pen.doc().paths.length, 0);
  pen.tool("pen");
  pen.down(ev(10, 10));
  pen.up(ev(10, 10));
  pen.down(ev(100, 10));
  pen.up(ev(100, 10));
  pen.key(keyEv("Enter"));
  assert.ok(pen.state().selected);
  assert.strictEqual(pen.key(keyEv("Escape")), true);
  assert.strictEqual(pen.state().selected, null);
  assert.strictEqual(pen.tool(), "pen");
});

test("resize keeps the canvas the size of the picture (same as the pose overlay)", async function () {
  const { pen, canvas } = await setup();
  pen.resize(1920, 1080);
  assert.deepStrictEqual([canvas.width, canvas.height], [1920, 1080]);
});

test("pointer capture that throws (pointer no longer active) never leaves the pen stuck (seen live 2026-11-24 12:4x)",
  async function () {
    const { pen, canvas } = await setup();
    canvas.setPointerCapture = function () {
      throw new Error("NotFoundError: No active pointer with the given id is found.");
    };
    pen.tool("pen");
    pen.down(ev(10, 10, { pointerId: 5 }));
    pen.up(ev(10, 10, { pointerId: 5 }));
    assert.strictEqual(pen.doc().paths[0].points.length, 1, "the click still places its point");
    pen.down(ev(100, 10, { pointerId: 9 }));
    pen.up(ev(100, 10, { pointerId: 9 }));
    assert.strictEqual(pen.doc().paths[0].points.length, 2, "the next click is not ignored");
  });

test("a pointer whose up never came (lost capture) is released by the next primary down", async function () {
  const { pen } = await setup();
  pen.tool("pen");
  pen.down(ev(10, 10, { pointerId: 3 }));
  pen.down(ev(100, 10, { pointerId: 4 }));
  pen.up(ev(100, 10, { pointerId: 4 }));
  assert.strictEqual(pen.doc().paths[0].points.length, 2);
});
