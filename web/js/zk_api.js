// FACADE window.zk: builds the page parts (video, pose, overlay, capture, selftest, POV, export) and the script API.
// API notes: docs/zk_api.js.md. Components get `parts` ({ zk, pov }) and never the parts behind them.
import { createVideo } from "./zk_video.js";
import { createCapture } from "./zk_capture.js";
import { createPose } from "./zk_pose.js";
import { createFace } from "./zk_face.js";
import { createOverlay } from "./zk_overlay.js";
import { createSelftest } from "./zk_selftest.js";
import { createPovApi } from "./zk_povapi.js";
import { createSidePic } from "./zk_sidepic.js";
import { createExporter } from "./zk_exporter.js";
import { createRange } from "./zk_range.js";
import { createEditStore } from "./zk_editstore.js";
import { createRender } from "./zk_render.js";
import { EVENTS } from "./zk_events.js";

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function makeInfo(ctx) {
  const { k, el, state } = ctx;
  return function info() {
    const v = el.video;
    const still = !!state.still;
    return {
      version: k.version, name: state.name, base: state.base, url: state.url, still,
      side: state.side ? state.side.name : null,
      width: still ? el.still.naturalWidth : v.videoWidth, height: still ? el.still.naturalHeight : v.videoHeight,
      duration: still ? 0 : v.duration,
      fps: `${state.fpsNum}/${state.fpsDen}`, total: state.total,
      frame: state.frame, shown: state.shown, mediaTime: state.mediaTime,
      lastCapture: state.lastCapture, hasPose: !!state.lastPose, pov: state.pov, lastExport: state.lastExport,
    };
  };
}

function povCalls(ctx, pov, exporter, range, edits) {
  return {
    view: function (v) {
      return (v === undefined ? pov.nextView() : pov.view(v)).view;
    },
    person: function (i) {
      return pov.person(i).person;
    },
    swap: function () {
      const p = pov.swap();
      return { frame: p.frame, swapped: p.swapped };
    },
    camera: pov.camera,
    preset: function (name) {
      const cam = pov.preset(name);
      if (!cam) {
        throw new Error(`unknown preset ${name}`);
      }
      return cam;
    },
    layers: function (patch) {
      return pov.options({ layers: patch || {} }).layers;
    },
    names: function (patch) {
      return pov.options({ names: patch || {} }).names;
    },
    options: pov.options,
    povPoints: function () {
      const p = pov.points();
      if (!p) {
        return null;
      }
      return { op: p.pov.op, mp: p.pov.mp, face: p.pov.face, width: p.size.width, height: p.size.height, camera: p.camera };
    },
    exportPose: exporter.exportPose,
    exportRange: range.exportRange,
    stopRange: range.stop,
    editMode: function (on) {
      const now = edits.mode(on === undefined ? !edits.mode() : !!on);
      ctx.status(ctx.t(now ? "editOn" : "editOff"), now ? "ok" : "");
      return now;
    },
    movePoint: edits.movePoint,
    resetPoint: edits.resetPoint,
    resetFrame: edits.resetFrame,
    edits: edits.edits,
  };
}

export function makeApi(ctx) {
  const info = makeInfo(ctx);
  let overlay = null;
  const hooks = {
    onClear: function () {
      overlay.clear();
      ctx.bus.emit(EVENTS.pose, null);
    },
    onSize: function (w, h) {
      overlay.resize(w, h);
    },
    onPose: function () {
      overlay.draw();
      ctx.bus.emit(EVENTS.pose, ctx.state.lastPose);
    },
  };
  const video = createVideo(ctx, hooks);
  const pose = createPose(ctx, video, hooks);
  const face = createFace(ctx);
  overlay = createOverlay(ctx, pose.connections);
  // Pose, then the face of every person on the same frame; a face error never stops the pose.
  const edits = createEditStore(ctx, { fetch: globalThis.fetch.bind(globalThis) });
  const poseAll = async function () {
    const p = await pose.pose();
    try {
      await face.attach(p, video.frameCanvas());
    } catch (e) {
      ctx.log(ctx.t("error", { message: e.message }));
    }
    ctx.state.lastPose = await edits.apply(p);
    hooks.onPose();
    return ctx.state.lastPose;
  };
  const capture = createCapture(ctx, video);
  const test = createSelftest(ctx, video);
  const pov = createPovApi(ctx);
  const sidePic = createSidePic(ctx, pose, pov);
  const render = createRender(ctx.k, ctx.cfg, makeCanvas);
  const exporter = createExporter(ctx, { povApi: pov, render, pose: poseAll, fetch: globalThis.fetch.bind(globalThis) });
  const range = createRange(ctx, { seek: video.seek, pose: poseAll, povApi: pov, exporter });
  ctx.bus.on(EVENTS.pov, overlay.draw);
  ctx.bus.on(EVENTS.pose, overlay.draw);
  const api = {
    load: async function (src) {
      await video.load(src);
      try {
        await sidePic.find(src);
      } catch (e) {
        ctx.log(ctx.t("error", { message: e.message }));
      }
      return info();
    },
    seek: video.seek,
    step: video.step,
    capture: capture.capture,
    pose: poseAll,
    info,
    setFps: async function (str) {
      await video.setFps(str);
      return info();
    },
    selftest: test.selftest,
    readBits: test.readBits,
    get lastPose() {
      return ctx.state.lastPose;
    },
    ...povCalls(ctx, pov, exporter, range, edits),
  };
  return { api, overlay, parts: { zk: api, pov } };
}
