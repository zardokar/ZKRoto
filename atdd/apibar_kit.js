// Test helper for the apibar tests: the component mounted on the fake DOM with fake models / ai parts that log calls.
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { install } = require("./fake_dom.js");

const WEB = path.join(__dirname, "..", "web");
const CFG = JSON.parse(fs.readFileSync(path.join(WEB, "config", "zkroto.json"), "utf8"));
const K = JSON.parse(fs.readFileSync(path.join(WEB, "constants", "zkroto.json"), "utf8"));

function url(...p) {
  return pathToFileURL(path.join(WEB, ...p)).href;
}

function walk(node, out) {
  out.push(node);
  (node.children || []).forEach((c) => walk(c, out));
  return out;
}

async function mounted(opts) {
  install();
  const opened = [];
  globalThis.open = (u, t, f) => opened.push([u, t, f]);
  const { createBus, EVENTS } = await import(url("js", "zk_events.js"));
  const { mount } = await import(url("components", "apibar", "apibar.js"));
  const host = document.createElement("div");
  const calls = [];
  const models = { refresh: async (force) => calls.push(["refresh", force]), choose: (id) => calls.push(["choose", id]),
    setKey: (k) => calls.push(["setKey", k]), clearKey: () => calls.push(["clearKey"]), masked: () => ((opts || {}).masked === undefined ? "••••7Q2x" : opts.masked) };
  const ai = { resume: async () => calls.push(["resume"]), retry: async () => calls.push(["retry"]),
    forget: () => calls.push(["forget"]) };
  const ctx = { cfg: CFG, k: K, bus: createBus(), t: (key, v) => K.text[key].replace("{time}", (v || {}).time) };
  mount(host, ctx, { models, ai });
  const all = () => walk(host, []);
  const byClass = (c) => all().find((n) => (n.className || "").split(" ").includes(c));
  return { host, ctx, EVENTS, calls, opened, byClass, all };
}

module.exports = { CFG, K, WEB, url, walk, mounted, fs, path };
