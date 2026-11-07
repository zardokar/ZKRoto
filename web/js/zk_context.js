// COMPONENT: shared context for the page - config, constants, DOM elements, state, log and status line.
import { fmt } from "./zk_text.js";
import { parseFps } from "./zk_frames.js";

const ELEMENT_IDS = ["video", "overlay", "scrub", "frame", "total", "tc", "name", "file", "fps", "drop", "stage",
  "btnLoad", "btnCapture", "btnPose", "showPose", "status", "log"];

function findElements(doc) {
  const el = {};
  for (const id of ELEMENT_IDS) {
    el[id] = doc.getElementById(id);
  }
  return el;
}

function newState(cfg) {
  const fps = parseFps(cfg.defaultFps);
  return {
    name: null, base: null, url: null,
    fpsNum: fps.num, fpsDen: fps.den,
    frame: 0, total: 0, shown: null, mediaTime: null,
    lastCapture: null, lastPose: null,
  };
}

// Static page text lives in constants (ui.*): data-text fills textContent, data-placeholder the placeholder.
function applyTexts(doc, ui) {
  doc.querySelectorAll("[data-text]").forEach(function (node) {
    node.textContent = ui[node.dataset.text];
  });
  doc.querySelectorAll("[data-placeholder]").forEach(function (node) {
    node.placeholder = ui[node.dataset.placeholder];
  });
}

export function createContext(cfg, k, doc) {
  applyTexts(doc, k.ui);
  const el = findElements(doc);
  const state = newState(cfg);
  const t = function (key, vars) {
    return fmt(k.text[key], vars || {});
  };
  const log = function (msg) {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    el.log.textContent = (line + "\n" + el.log.textContent).slice(0, cfg.logMaxChars);
    console.log(k.consoleTag, msg);
  };
  const status = function (msg, cls) {
    el.status.textContent = msg;
    el.status.className = cls || "";
  };
  const fps = function () {
    return state.fpsNum / state.fpsDen;
  };
  return { cfg, k, el, state, t, log, status, fps };
}
