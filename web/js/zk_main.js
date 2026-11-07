// Entry of the ZKRoto page: reads config + constants, builds the parts, exposes window.zk. API notes: docs/zk_api.js.md
import { createContext } from "./zk_context.js";
import { createVideo } from "./zk_video.js";
import { createCapture } from "./zk_capture.js";
import { createPose } from "./zk_pose.js";
import { createOverlay } from "./zk_overlay.js";
import { createSelftest } from "./zk_selftest.js";
import { bindUi, guarded } from "./zk_ui.js";
import cfg from "../config/zkroto.json" with { type: "json" };
import k from "../constants/zkroto.json" with { type: "json" };

function makeInfo(ctx) {
  const { k, el, state } = ctx;
  return function info() {
    const v = el.video;
    return {
      version: k.version, name: state.name, base: state.base, url: state.url,
      width: v.videoWidth, height: v.videoHeight, duration: v.duration,
      fps: `${state.fpsNum}/${state.fpsDen}`, total: state.total,
      frame: state.frame, shown: state.shown, mediaTime: state.mediaTime,
      lastCapture: state.lastCapture, hasPose: !!state.lastPose,
    };
  };
}

function makeApi(ctx) {
  const info = makeInfo(ctx);
  let overlay = null;
  const hooks = {
    onClear: function () {
      overlay.clear();
    },
    onSize: function (w, h) {
      overlay.resize(w, h);
    },
    onPose: function () {
      overlay.draw();
    },
  };
  const video = createVideo(ctx, hooks);
  const pose = createPose(ctx, video, hooks);
  overlay = createOverlay(ctx, pose.connections);
  const capture = createCapture(ctx, video);
  const test = createSelftest(ctx, video);
  const api = {
    load: async function (src) {
      await video.load(src);
      return info();
    },
    seek: video.seek,
    step: video.step,
    capture: capture.capture,
    pose: pose.pose,
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
  };
  return { api, overlay };
}

function start() {
  const ctx = createContext(cfg, k, document);
  const { api, overlay } = makeApi(ctx);
  bindUi(ctx, api, overlay);
  ctx.status(ctx.t("ready"));
  window.zk = api;
  const q = new URLSearchParams(location.search);
  if (q.get("fps")) {
    api.setFps(q.get("fps"));
  }
  if (q.get("video")) {
    guarded(ctx, api.load)(q.get("video")).then(function () {
      return q.get("frame") && api.seek(Number(q.get("frame")));
    }).catch(function () {
      return null;
    });
  }
  ctx.log(ctx.t("readyLog", { version: k.version }));
}

start();
