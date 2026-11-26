// Undo / redo of the pen doc (Koh 14:39; canvas cv_history.js + cv_tools.js cvHistStep): one finished action =
// one step, a new action kills the redo line, at most max steps, Esc on an open line and no-change take no step,
// and while a line is open Ctrl+Z still steps back one point (cvPenStep).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { setup, ev, key } = require("./pen_kit.js");

const TOL = { line: 6, point: 11, bend: 4 };

function mod(name) {
  return import(pathToFileURL(path.join(__dirname, "..", "web", "js", name)).href);
}

async function kit() {
  const H = await mod("zk_penhistory.js");
  const T = await mod("zk_pentools.js");
  const st = T.newState();
  const h = H.newHistory(3);
  H.resetHistory(h, st);
  const shape = function (x) {
    st.tool = "pen";
    for (const [px, py] of [[x, 0], [x + 50, 0], [x + 50, 50]]) {
      T.penDown(st, { x: px, y: py }, {}, TOL);
      T.penUp(st);
      assert.strictEqual(H.settle(h, st), false, "no step while the line is open");
    }
    T.penFinish(st);
    return H.settle(h, st);
  };
  return { H, T, st, h, shape };
}

test("a whole shape is one step; undo / redo walk it; a new action kills the redo line", async function () {
  const { H, st, h, shape } = await kit();
  assert.strictEqual(shape(0), true);
  assert.strictEqual(shape(100), true);
  assert.strictEqual(H.stepHistory(h, st, true), true);
  assert.strictEqual(st.doc.paths.length, 1);
  assert.strictEqual(H.stepHistory(h, st, false), true);
  assert.strictEqual(st.doc.paths.length, 2);
  H.stepHistory(h, st, true);
  shape(200);
  assert.strictEqual(H.stepHistory(h, st, false), false, "redo line is gone");
  assert.deepStrictEqual(st.doc.paths.map((p) => p.points[0].x), [0, 200]);
  assert.notStrictEqual(st.doc.paths[0].id, st.doc.paths[1].id, "ids never come back after an undo");
});

test("at most max steps are kept; nothing changed = no step; a selection change alone is not a step",
  async function () {
    const { H, st, h, shape } = await kit();
    for (let i = 0; i < 5; i += 1) {
      shape(i * 100);
    }
    st.selected = st.doc.paths[0].id;
    assert.strictEqual(H.settle(h, st), false);
    let n = 0;
    while (H.stepHistory(h, st, true)) {
      n += 1;
    }
    assert.strictEqual(n, 3);
    assert.strictEqual(st.doc.paths.length, 2);
    assert.strictEqual(st.selected, null, "undo clears the choice (cvSelectionClear)");
  });

test("Esc on an open line takes no step; an unsettled change is kept before undo", async function () {
  const { H, T, st, h, shape } = await kit();
  shape(0);
  st.tool = "pen";
  T.penDown(st, { x: 300, y: 300 }, {}, TOL);
  T.penUp(st);
  T.penCancel(st);
  assert.strictEqual(H.settle(h, st), false);
  const was = st.doc.paths[0].fill;
  st.doc.paths[0].fill = "#ff0000";
  assert.strictEqual(H.stepHistory(h, st, true), true);
  assert.strictEqual(st.doc.paths[0].fill, was, "the colour change was its own step");
  H.stepHistory(h, st, false);
  assert.strictEqual(st.doc.paths[0].fill, "#ff0000");
});

test("keys: Ctrl+Z / Cmd+Z undo, Ctrl+Y / Ctrl+Shift+Z redo when no line is open", async function () {
  const { penKey } = await mod("zk_penkeys.js");
  assert.deepStrictEqual(penKey(key("KeyZ", { ctrlKey: true, key: "ผ" }), {}), { kind: "undo", back: true });
  assert.deepStrictEqual(penKey(key("KeyZ", { metaKey: true }), {}), { kind: "undo", back: true });
  assert.deepStrictEqual(penKey(key("KeyY", { ctrlKey: true }), {}), { kind: "undo", back: false });
  assert.deepStrictEqual(penKey(key("KeyZ", { ctrlKey: true, shiftKey: true }), {}), { kind: "undo", back: false });
});

test("the pen facade: draw, Delete, Ctrl+Z brings the shape back, Ctrl+Y deletes it again; a new picture clears",
  async function () {
    const { pen } = await setup();
    pen.tool("pen");
    for (const [x, y] of [[10, 10], [100, 10], [100, 60]]) {
      pen.down(ev(x, y));
      pen.up(ev(x, y));
    }
    pen.key(key("Enter", { key: "Enter" }));
    pen.tool("select");
    pen.down(ev(55, 10));
    pen.up(ev(55, 10));
    pen.key(key("Delete", { key: "Delete" }));
    assert.strictEqual(pen.doc().paths.length, 0);
    assert.strictEqual(pen.key(key("KeyZ", { ctrlKey: true })), true);
    assert.strictEqual(pen.doc().paths.length, 1);
    pen.key(key("KeyY", { ctrlKey: true }));
    assert.strictEqual(pen.doc().paths.length, 0);
    pen.key(key("KeyZ", { ctrlKey: true }));
    pen.key(key("KeyZ", { ctrlKey: true }));
    assert.strictEqual(pen.doc().paths.length, 0, "back to the empty start");
    pen.reset();
    assert.strictEqual(pen.key(key("KeyY", { ctrlKey: true })), true);
    assert.strictEqual(pen.doc().paths.length, 0, "a new picture has no history");
  });

test("review: a toolbar tool switch, a cancelled pointer and a colour change each settle; steps do not merge",
  async function () {
    const { pen } = await setup();
    pen.tool("pen");
    for (const [x, y] of [[10, 10], [100, 10]]) {
      pen.down(ev(x, y));
      pen.up(ev(x, y));
    }
    pen.tool("point");
    pen.down(ev(10, 10));
    pen.move(ev(10, 40));
    pen.cancel(ev(10, 40));
    pen.color.apply("#ff0000");
    pen.down(ev(300, 300));
    pen.up(ev(300, 300));
    pen.key(key("KeyZ", { ctrlKey: true }));
    assert.strictEqual(pen.doc().paths.length, 1, "undo takes back the colour only");
    assert.notStrictEqual(pen.doc().paths[0].fill, "#ff0000");
    pen.key(key("KeyZ", { ctrlKey: true }));
    assert.strictEqual(pen.doc().paths.length, 1, "then the move");
    assert.strictEqual(pen.doc().paths[0].points[0].y, 20);
    pen.key(key("KeyZ", { ctrlKey: true }));
    assert.strictEqual(pen.doc().paths.length, 0, "then the line");
  });

test("review: Ctrl+Z while an A or V drag runs is ignored (the drag is not lost, the step before stays)",
  async function () {
    const { pen } = await setup();
    pen.tool("pen");
    for (const [x, y] of [[10, 10], [100, 10]]) {
      pen.down(ev(x, y));
      pen.up(ev(x, y));
    }
    pen.key(key("Enter", { key: "Enter" }));
    pen.tool("point");
    pen.down(ev(10, 10));
    pen.move(ev(10, 30));
    pen.key(key("KeyZ", { ctrlKey: true }));
    pen.move(ev(10, 40));
    pen.up(ev(10, 40));
    assert.strictEqual(pen.doc().paths.length, 1);
    assert.strictEqual(pen.doc().paths[0].points[0].y, 80, "the drag went on to the end");
    pen.key(key("KeyZ", { ctrlKey: true }));
    assert.strictEqual(pen.doc().paths[0].points[0].y, 20, "one undo = the drag");
  });

test("review: a release outside the canvas (window pointerup) ends the drag, so history keeps recording",
  async function () {
    const { pen } = await setup();
    pen.tool("pen");
    pen.down(ev(10, 10));
    pen.windowUp(ev(10, 10));
    assert.strictEqual(pen.state().grab, null);
  });
