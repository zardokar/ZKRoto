// Runtime check: window.zk is ready as soon as the page modules have evaluated (as in 0.1.1), not later.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");
const { install } = require("./fake_dom.js");

const MAIN = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_main.js")).href;
const API = ["load", "seek", "step", "capture", "pose", "info", "setFps", "selftest", "readBits"];

test("window.zk, page text and fps list are ready right after the modules evaluate", async function () {
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
});
