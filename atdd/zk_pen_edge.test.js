// Pen facade edge cases from the independent review (2026-11-24 12:5x): a new picture clears the pen, a hidden pen
// canvas takes no keys, a tool switch drops a held pointer, a dropped 1-point line is not left chosen.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { setup, ev } = require("./pen_kit.js");

function keyEv(code, more) {
  return { code, key: code, target: { tagName: "BODY" }, preventDefault: function () {
    return null;
  }, ...more };
}

test("reset (new picture loaded) drops every path and the open line", async function () {
  const { pen } = await setup();
  pen.tool("pen");
  pen.down(ev(10, 10));
  pen.up(ev(10, 10));
  pen.reset();
  assert.strictEqual(pen.doc().paths.length, 0);
  assert.strictEqual(pen.state().pen, null);
  assert.strictEqual(pen.state().selected, null);
});

test("hidden pen canvas (POV view, box width 0) takes no pen keys", async function () {
  const { pen, canvas } = await setup();
  canvas.getBoundingClientRect = function () {
    return { left: 0, top: 0, width: 0, height: 0 };
  };
  assert.strictEqual(pen.key(keyEv("KeyP")), false);
  assert.strictEqual(pen.tool(), "select");
});

test("switching tool while a pointer is held releases it (the next pointer of another id still works)", async function () {
  const { pen } = await setup();
  pen.tool("select");
  pen.down(ev(10, 10, { pointerId: 3 }));
  pen.tool("pen");
  assert.strictEqual(pen.move(ev(20, 20, { pointerId: 8 })), true, "a move of another pointer is not ignored");
});

test("finishing a 1-point line drops it and leaves nothing chosen", async function () {
  const { pen } = await setup();
  pen.tool("pen");
  pen.down(ev(10, 10));
  pen.up(ev(10, 10));
  pen.key(keyEv("Enter"));
  assert.strictEqual(pen.doc().paths.length, 0);
  assert.strictEqual(pen.state().selected, null);
});

test("Delete / Backspace are silent in any input (cvKeyInField), not on a button (canvas spec)", async function () {
  const { penKey } = await import(pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_penkeys.js")).href);
  const st = { tool: "select", selected: "p1" };
  assert.deepStrictEqual(penKey(keyEv("Backspace", { target: { tagName: "BUTTON" } }), st), { kind: "delete" });
  assert.strictEqual(penKey(keyEv("Delete", { target: { tagName: "INPUT", type: "range" } }), st), null);
  assert.deepStrictEqual(penKey(keyEv("Delete"), st), { kind: "delete" });
});
