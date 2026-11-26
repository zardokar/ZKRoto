// FACADE part: the page side of a request to Claude (Koh 2026-11-24 15:37-16:24, wf_zkreq_3): send() POSTs mask,
// picture, shapes SVG and req.json to /zkroto/request (zk_request.py); exportSvg() downloads <picture>_shapes.svg;
// list() reads /zkroto/requests; answers seen are kept per browser (localStorage, wrapped: it can throw).
import { requestId, drawMask, requestBody, flatAnswers, unseen } from "./zk_reqmake.js";
import { toSvg } from "./zk_pensvg.js";
import { importSvg as parseSvg } from "./zk_svgimport.js";
import { EVENTS } from "./zk_events.js";

const SEEN_KEY = "zkroto.seenAnswers";

function loadSeen(store) {
  try {
    return new Set(JSON.parse(store.getItem(SEEN_KEY) || "[]"));
  } catch (_e) {
    return new Set();
  }
}

function saveSeen(store, seen) {
  try {
    store.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch (_e) {
    return;
  }
}

function localTime(d) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" +
    p(d.getMinutes()) + ":" + p(d.getSeconds());
}

export function createRequester(ctx, deps) {
  const seen = loadSeen(deps.store);
  let answers = [];
  let lastId = "";

  // One id per press: a second press in the same second takes the next second (ids sort by time).
  function nextId() {
    const t = deps.now();
    let id = requestId(t);
    while (id <= lastId) {
      t.setSeconds(t.getSeconds() + 1);
      id = requestId(t);
    }
    lastId = id;
    return { id, t };
  }

  async function send() {
    try {
      return await trySend();
    } catch (e) {
      ctx.status(ctx.t("reqFailed", { message: e.message }), "err");
      return null;
    }
  }

  async function trySend() {
    const out = await write();
    if (!out) {
      return null;
    }
    ctx.status(ctx.t("reqSent", { id: out.id }), "ok");
    ctx.bus.emit(EVENTS.request, { sent: out.id });
    return { id: out.id, folder: out.folder, shapes: out.shapes };
  }

  // The request folder alone (Send through the Claude API uses it too): returns id, size and the two pictures.
  async function write() {
    const info = deps.info();
    if (!info.width) {
      ctx.status(ctx.t("reqNoPicture"), "err");
      return null;
    }
    const doc = deps.pen.doc();
    const mask = deps.makeCanvas(info.width, info.height);
    const shapes = drawMask(mask.getContext("2d"), doc, info.width, info.height);
    if (!shapes) {
      ctx.status(ctx.t("reqNothing"), "err");
      return null;
    }
    const { id, t } = nextId();
    const maskUrl = mask.toDataURL("image/png");
    const srcUrl = deps.frameCanvas().toDataURL("image/png");
    const body = requestBody({ id, mask: maskUrl, src: srcUrl, svg: toSvg(doc, info.width, info.height), shapes, info,
      time: localTime(t) });
    const res = await deps.fetch("/zkroto/request", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) });
    const out = await res.json();
    if (!res.ok) {
      ctx.status(ctx.t("reqFailed", { message: out.error }), "err");
      return null;
    }
    ctx.log(ctx.t("reqSentLog", { id: body.id, folder: out.folder }));
    return { id: body.id, folder: out.folder, shapes, width: info.width, height: info.height, src: srcUrl, mask: maskUrl };
  }

  // Import (Koh 2026-11-25): the shapes of an .svg file ADDED onto the picture, scaled from its viewBox.
  function importSvg(text, name) {
    const info = deps.info();
    if (!info.width) {
      ctx.status(ctx.t("reqNoPicture"), "err");
      return 0;
    }
    let got = null;
    try {
      if (String(text).length > ctx.cfg.ai.importMaxBytes) {
        throw new Error("file larger than " + ctx.cfg.ai.importMaxBytes + " bytes");
      }
      got = parseSvg(text, { width: info.width, height: info.height }, ctx.cfg.ai.importMaxShapes);
    } catch (e) {
      ctx.status(ctx.t("aiImportBad", { message: e.message }), "err");
      return 0;
    }
    const n = deps.pen.addPaths(got.paths);
    const key = n ? "aiImported" : "aiImportNone";
    ctx.status(ctx.t(key, { n, name: name || "", skipped: got.skipped }), n ? "ok" : "err");
    return n;
  }

  function exportSvg() {
    const info = deps.info();
    if (!info.width) {
      ctx.status(ctx.t("reqNoPicture"), "err");
      return null;
    }
    const name = (info.base || "zkroto") + "_shapes.svg";
    deps.download(name, toSvg(deps.pen.doc(), info.width, info.height));
    ctx.status(ctx.t("svgSaved", { name }), "ok");
    return name;
  }

  async function list() {
    const res = await deps.fetch("/zkroto/requests");
    answers = flatAnswers((await res.json()).requests || []);
    ctx.bus.emit(EVENTS.request, { answers: answers.length, unseen: unseen(answers, seen) });
    return answers;
  }

  function markSeen(key) {
    seen.add(key);
    saveSeen(deps.store, seen);
    ctx.bus.emit(EVENTS.request, { answers: answers.length, unseen: unseen(answers, seen) });
  }

  return { send, write, importSvg, exportSvg, list, markSeen, answers: () => answers };
}
