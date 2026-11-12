// Runtime check: window.zk is ready as soon as the page modules have evaluated (as in 0.1.1), not later.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { install } = require("./fake_dom.js");

const MAIN = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_main.js")).href;
const API = ["load", "seek", "step", "capture", "pose", "info", "setFps", "selftest", "readBits",
  "view", "person", "swap", "camera", "preset", "layers", "names", "options", "povPoints", "exportPose",
  "exportRange", "stopRange",
  "editMode", "movePoint", "resetPoint", "resetFrame", "edits"];
const CFG = require("../web/config/zkroto.json");

test("window.zk, page text, fps list and every component are ready right after the modules evaluate", async function () {
  install();
  const log = console.log;
  console.log = function () {
    return null;
  };
  try {
    await import(MAIN);
  } finally {
    console.log = log;
  }
  assert.strictEqual(typeof globalThis.zk, "object");
  for (const name of API) {
    assert.strictEqual(typeof globalThis.zk[name], "function", name);
  }
  assert.strictEqual(document.getElementById("status").textContent, "ready");
  assert.strictEqual(document.getElementById("fps").options.length, 6);
  assert.strictEqual(document.getElementById("btnLoad").textContent, "Load");
  for (const [slot, names] of Object.entries(CFG.layout.slots)) {
    const hosts = document.querySelector(`[data-slot="${slot}"]`).children;
    assert.deepStrictEqual(hosts.map(function (h) {
      return h.dataset.component;
    }), names, slot);
  }
  assert.strictEqual(document.head.children.length, Object.values(CFG.layout.slots).flat().length, "one CSS per component");
  for (const link of document.head.children) {
    assert.match(link.href, /^components\/(\w+)\/\1\.css\?v=\d+\.\d+\.\d+$/, link.href);
    assert.strictEqual(link.href.split("?v=")[1], globalThis.zk.info().version);
  }
  assert.strictEqual(document.body.dataset.view, "source");
  assert.strictEqual(globalThis.zk.view(), "pov");
  assert.strictEqual(document.body.dataset.view, "pov");
  assert.strictEqual(globalThis.zk.povPoints(), null, "no pose yet");
});
