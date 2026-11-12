// Keys of web/js/zk_ui.js onKey: Ctrl+E = Export (also in a text field, not on repeat), V / C / P by key place
// (e.code, so the Thai layout works), nothing with Ctrl / Alt except Ctrl+E.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_ui.js")).href;

class FakeInput {
  constructor(type) {
    this.type = type;
  }
}

function setup() {
  globalThis.HTMLInputElement = FakeInput;
  const calls = [];
  const spy = function (name) {
    return async function () {
      calls.push(name);
    };
  };
  const api = { exportPose: spy("export"), view: spy("view"), capture: spy("capture"), pose: spy("pose"), step: spy("step"),
    editMode: spy("edit") };
  const ctx = { cfg: { bigStep: 10 }, status: function () {
    return null;
  }, log: function () {
    return null;
  }, t: function () {
    return "";
  } };
  return { api, ctx, calls };
}

function key(code, more) {
  return { code, key: "x", target: {}, preventDefault: function () {
    return null;
  }, ...more };
}

test("Ctrl+E exports once (not on repeat), also while typing in a name field; plain E toggles editing (0.3.0)", async function () {
  const { onKey } = await import(MODULE);
  const { api, ctx, calls } = setup();
  onKey(ctx, api, key("KeyE", { ctrlKey: true }));
  onKey(ctx, api, key("KeyE", { ctrlKey: true, repeat: true }));
  onKey(ctx, api, key("KeyE", { ctrlKey: true, target: new FakeInput("text") }));
  onKey(ctx, api, key("KeyE", { target: new FakeInput("text") }));
  assert.deepStrictEqual(calls, ["export", "export"], "plain E inside a text field types the letter");
});

test("V / C / P by key place: the Thai layout (key 'อ' on KeyV) still switches the view", async function () {
  const { onKey } = await import(MODULE);
  const { api, ctx, calls } = setup();
  onKey(ctx, api, key("KeyV", { key: "อ" }));
  onKey(ctx, api, key("KeyC", { key: "แ" }));
  onKey(ctx, api, key("KeyP", { key: "ย" }));
  assert.deepStrictEqual(calls, ["view", "capture", "pose"]);
});

test("single keys do nothing in a text field or with Ctrl / Alt (Ctrl+V pastes, Ctrl+C copies)", async function () {
  const { onKey } = await import(MODULE);
  const { api, ctx, calls } = setup();
  onKey(ctx, api, key("KeyV", { target: new FakeInput("text") }));
  onKey(ctx, api, key("KeyV", { ctrlKey: true }));
  onKey(ctx, api, key("KeyC", { ctrlKey: true }));
  onKey(ctx, api, key("KeyP", { altKey: true }));
  onKey(ctx, api, key("KeyV", { target: new FakeInput("checkbox") }));
  assert.deepStrictEqual(calls, ["view"]);
});

test("E (by key place, no Ctrl) toggles point editing; Ctrl+E still exports", async function () {
  const { onKey } = await import(MODULE);
  const { api, ctx, calls } = setup();
  onKey(ctx, api, key("KeyE"));
  onKey(ctx, api, key("KeyE", { ctrlKey: true }));
  await new Promise(function (r) {
    setTimeout(r, 0);
  });
  assert.deepStrictEqual(calls, ["edit", "export"]);
});
