// Imported shapes are ADDED to the shapes already drawn (Koh's answer 2026-11-25 21:0x) as ONE undo step; new ids;
// one imported shape is chosen right away (V box). The pen chooses one shape at a time, so several are not chosen.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { setup, key } = require("./pen_kit.js");

const LINE = { kind: "poly", closed: false, fill: "none", stroke: "#ff0000", stroke_width: 2,
  points: [{ x: 1, y: 1 }, { x: 50, y: 1 }] };

test("addPaths: added after existing paths, new ids, one undo step, one shape chosen when only one came in",
  async function () {
    const { pen } = await setup();
    const doc = pen.doc();
    doc.paths.push({ id: "p1", kind: "poly", closed: false, fill: "none", stroke: "#000000", stroke_width: 2,
      points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] });
    doc.seq = 1;
    pen.settle();
    assert.strictEqual(pen.addPaths([LINE, Object.assign({}, LINE, { stroke: "#00ff00" })]), 2);
    assert.deepStrictEqual(pen.doc().paths.map((p) => p.id), ["p1", "p2", "p3"]);
    assert.strictEqual(pen.state().selected, null, "two came in: none chosen");
    pen.key(key("KeyZ", { ctrlKey: true }));
    assert.deepStrictEqual(pen.doc().paths.map((p) => p.id), ["p1"], "one Ctrl+Z = the whole import");
    pen.addPaths([LINE]);
    assert.strictEqual(pen.state().selected, pen.doc().paths[1].id);
    assert.strictEqual(pen.addPaths([]), 0);
  });
