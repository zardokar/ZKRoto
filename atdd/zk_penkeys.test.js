// Pen keys (web/js/zk_penkeys.js) = the canvas module's key table (cv_key_edit.js, cv_key_menu.js, cv_key_common.js,
// docs/cv_keys.js.md, atdd/js/test_cv_keys.js) for the tools ZKRoto has: P / V / A, Delete / Backspace, Esc, Enter,
// Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z; keys by e.code (Thai layout); silent in input / textarea / select / contenteditable.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_penkeys.js")).href;

function key(code, more) {
  return { code, key: "x", target: { tagName: "DIV" }, ...more };
}

async function nameOf(e, st) {
  const { penKey } = await import(MODULE);
  return (penKey(e, st || {}) || {}).kind;
}

test("tool keys V = select, A = point, P = pen; Thai layout by key place; Alt does not block them (cvKeyToAction)",
  async function () {
    const { penKey } = await import(MODULE);
    assert.deepStrictEqual(penKey(key("KeyV", { key: "ฟ" }), {}), { kind: "tool", name: "select" });
    assert.deepStrictEqual(penKey(key("KeyA", { key: "ฟ" }), {}), { kind: "tool", name: "point" });
    assert.deepStrictEqual(penKey(key("KeyP", { key: "ษ" }), {}), { kind: "tool", name: "pen" });
    assert.deepStrictEqual(penKey(key("KeyZ", { key: "ผ" }), {}), { kind: "tool", name: "zoom" });
    assert.deepStrictEqual(penKey(key("KeyP", { altKey: true }), {}), { kind: "tool", name: "pen" });
    assert.strictEqual(penKey(key("KeyQ"), {}), null, "a key not bound does nothing");
  });

test("Ctrl+P is the browser's (print), not the pen; Ctrl+V / Ctrl+A not the tools", async function () {
  const { penKey } = await import(MODULE);
  assert.strictEqual(penKey(key("KeyP", { ctrlKey: true }), {}), null);
  assert.strictEqual(penKey(key("KeyV", { ctrlKey: true }), {}), null);
  assert.strictEqual(penKey(key("KeyA", { metaKey: true }), {}), null);
});

test("silent while typing: input (any type), textarea, select, contenteditable; a plain div works", async function () {
  const { penKey } = await import(MODULE);
  for (const target of [{ tagName: "INPUT", type: "text" }, { tagName: "INPUT", type: "range" }, { tagName: "textarea" },
    { tagName: "SELECT" }, { tagName: "DIV", isContentEditable: true }]) {
    assert.strictEqual(penKey(key("KeyP", { target }), {}), null, JSON.stringify(target));
  }
  assert.strictEqual(penKey(key("KeyP", { target: null }), {}).name, "pen", "no target does not break");
});

test("Enter and NumpadEnter = finish (keep the open line); Escape = drop it while drawing (㉑ⓓ)", async function () {
  const drawing = { tool: "pen", drawing: true };
  assert.strictEqual(await nameOf(key("Enter", { key: "Enter" }), drawing), "finish");
  assert.strictEqual(await nameOf(key("NumpadEnter", { key: "Enter" }), drawing), "finish");
  assert.strictEqual(await nameOf(key("Escape", { key: "Escape" }), drawing), "cancel");
});

test("Escape with no line open clears the selection (cvKeyEscape), it does not turn the tools off", async function () {
  const { penKey } = await import(MODULE);
  assert.deepStrictEqual(penKey(key("Escape", { key: "Escape" }), { tool: "select", selected: "p1" }),
    { kind: "deselect" });
});

test("Delete and Backspace delete the chosen path (cvKeyDelete), also while a line is open", async function () {
  assert.strictEqual(await nameOf(key("Delete", { key: "Delete" }), { tool: "select", selected: "p1" }), "delete");
  assert.strictEqual(await nameOf(key("Backspace", { key: "Backspace" }), { tool: "point", selected: "p1" }), "delete");
  assert.strictEqual(await nameOf(key("Delete", { key: "Delete" }), { tool: "pen", drawing: true, selected: "p2" }),
    "delete");
  assert.strictEqual(await nameOf(key("Delete", { key: "Delete" }), { tool: "select", selected: null }), undefined);
});

test("Ctrl+Z one point back while drawing, Ctrl+Y / Ctrl+Shift+Z forward, Cmd+Z too, Thai layout (cvHistStep)",
  async function () {
    const { penKey } = await import(MODULE);
    const drawing = { drawing: true };
    assert.deepStrictEqual(penKey(key("KeyZ", { ctrlKey: true, key: "ผ" }), drawing), { kind: "step", back: true });
    assert.deepStrictEqual(penKey(key("KeyZ", { metaKey: true }), drawing), { kind: "step", back: true });
    assert.deepStrictEqual(penKey(key("KeyY", { ctrlKey: true }), drawing), { kind: "step", back: false });
    assert.deepStrictEqual(penKey(key("KeyZ", { ctrlKey: true, shiftKey: true }), drawing), { kind: "step", back: false });
  });

test("0 = fit (Digit0 also on the Thai layout); Space = the temporary pan modifier, not a tool", async function () {
  const { penKey } = await import(MODULE);
  assert.deepStrictEqual(penKey(key("Digit0", { key: ")" }), {}), { kind: "fit" });
  assert.deepStrictEqual(penKey(key("Space", { key: " " }), {}), { kind: "mod", name: "pan" });
  assert.strictEqual(penKey(key("Digit0", { ctrlKey: true }), {}), null, "Ctrl+0 stays the browser's");
});

test("Thai Kedmanee letters work even when the browser gives no key place (e.code empty): อ V, ฟ A, ย P, ผ Z, ร I, " +
  "ป X, ฝ /, จ 0 (Koh 13:58: V on Thai Windows)", async function () {
  const { penKey } = await import(MODULE);
  const pairs = [["อ", "select"], ["ฟ", "point"], ["ย", "pen"], ["ผ", "zoom"], ["ร", "eyedrop"]];
  for (const [ch, tool] of pairs) {
    assert.deepStrictEqual(penKey(key("", { key: ch }), {}), { kind: "tool", name: tool }, ch);
  }
  assert.strictEqual(penKey(key("", { key: "ป" }), {}).kind, "swap");
  assert.strictEqual(penKey(key("", { key: "ฝ" }), {}).kind, "none");
  assert.strictEqual(penKey(key("", { key: "จ" }), {}).kind, "fit");
});
