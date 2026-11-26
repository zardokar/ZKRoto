// FACADE: builds the Send-through-Claude parts for the page (wf_zkapi_3, Koh OK 2026-11-25 21:21): key + model list
// (zk_aimodels), the Claude API (zk_claudeapi), the ComfyUI run (zk_comfyrun) and the flow (zk_aisend).
import { createModelStore } from "./zk_modelstore.js";
import { createClaude } from "./zk_claudeapi.js";
import { createComfyRun } from "./zk_comfyrun.js";
import { createAiModels } from "./zk_aimodels.js";
import { createAiSend } from "./zk_aisend.js";
import { hairOf } from "./zk_hairpixels.js";

function two(n) {
  return String(n).padStart(2, "0");
}

function today() {
  const d = new Date();
  return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
}

function clock() {
  const d = new Date();
  return two(d.getHours()) + ":" + two(d.getMinutes());
}

function pause(ms) {
  return new Promise(function (ok) {
    setTimeout(ok, ms);
  });
}

// ComfyUI's websocket on the same host (progress of our prompt); none -> progress unknown.
function socket(path) {
  if (typeof WebSocket !== "function") {
    return null;
  }
  const scheme = location.protocol === "https:" ? "wss://" : "ws://";
  return new WebSocket(scheme + location.host + path);
}

// Pictures to Claude at most `max` px on the long side, JPEG (Claude's image limits; review 2026-11-25).
function shrink(url, max) {
  return new Promise(function (ok) {
    const img = new Image();
    img.onload = function () {
      const f = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * f));
      c.height = Math.max(1, Math.round(img.naturalHeight * f));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = function () {
      ok(url);
    };
    img.src = url;
  });
}

export function createAiParts(ctx, request) {
  const fetcher = globalThis.fetch.bind(globalThis);
  const store = createModelStore(globalThis.localStorage);
  const claude = createClaude({ fetch: fetcher, cfg: ctx.cfg.ai });
  const comfy = createComfyRun({ fetch: fetcher, cfg: ctx.cfg.ai, wait: pause, socket,
    clientId: "zkroto-" + Math.random().toString(36).slice(2) });
  const models = createAiModels(ctx, { claude, store, today, clock });
  const ai = createAiSend(ctx, { request, models, claude, comfy, wait: pause, shrink, hair: hairOf });
  return { models, ai };
}
