// Test helper for the Send flow tests: a fake page context and fake Claude / ComfyUI / request parts that log calls.
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const WEB = path.join(__dirname, "..", "web");
const CFG = JSON.parse(fs.readFileSync(path.join(WEB, "config", "zkroto.json"), "utf8"));
const K = JSON.parse(fs.readFileSync(path.join(WEB, "constants", "zkroto.json"), "utf8"));

function mod(name) {
  return import(pathToFileURL(path.join(WEB, "js", name)).href);
}

async function rig(opts) {
  const o = opts || {};
  const { createBus, EVENTS } = await mod("zk_events.js");
  const { createAiSend } = await mod("zk_aisend.js");
  const log = [];
  const events = [];
  const bus = createBus();
  for (const name of ["ai", "aiErr", "needKey"]) {
    bus.on(EVENTS[name], (d) => events.push([name, d]));
  }
  const ctx = { cfg: CFG, k: K, bus, t: (key) => key, status: (m, c) => log.push(["status", m, c]), log: (m) => log.push(["log", m]) };
  let key = o.key === undefined ? "sk-test" : o.key;
  const asks = o.asks || [{ content: [{ type: "text", text: '{"prompt":"(red hair:1.3), crimson hair","tint":"#b0182a","note":"n"}' }] }];
  const deps = {
    request: { write: async () => {
      log.push("write");
      return { id: "req_20261125_213000", width: 896, height: 1152, src: "data:image/png;base64,S", mask: "data:image/png;base64,M" };
    }, list: async () => log.push("list") },
    models: { key: () => key, model: () => "claude-sonnet-5-5" },
    claude: { ask: async (k, body) => {
      log.push(["ask", k, body.model]);
      const next = asks.shift();
      if (next instanceof Error) {
        throw next;
      }
      return next;
    }, abort: () => log.push("abort") },
    comfy: { queue: async (p) => {
      const hairNode = Object.values(p).find((n) => n.class_type === "LoadImageMask" && /hair\.png$/.test(n.inputs.image));
      log.push(["queue", p[13].inputs.denoise, p[10].inputs.text, hairNode ? hairNode.inputs.image : null]);
      return "pid1";
    }, wait: o.comfyWait || (async (id, onProgress) => {
      onProgress(0.5);
      return [{ filename: "a.png", subfolder: "ZKRoto_req", type: "output" }];
    }), png: o.png || (async () => "PNG64"), answer: async (rid, png, meta) => {
      log.push(["answer", rid, png, meta]);
      return { n: 1 };
    }, upload: async (rid, name, blob) => {
      if (o.uploadFails) {
        throw new Error("upload failed");
      }
      log.push(["upload", rid, name, blob]);
    }, interrupt: async (id) => log.push(id === "pid1" ? "interrupt" : "interrupt-wrong-id") },
    wait: async (ms) => log.push(["wait", ms]),
    shrink: async (url) => {
      log.push(["shrink", url.slice(-1)]);
      return url;
    },
  };
  if (o.hair) {
    deps.hair = o.hair(log);
  }
  if (o.request) {
    deps.request = o.request(deps.request, log);
  }
  const ai = createAiSend(ctx, deps);
  return { ai, log, events, EVENTS, setKey: (k) => {
    key = k;
  } };
}

module.exports = { CFG, K, mod, rig };
