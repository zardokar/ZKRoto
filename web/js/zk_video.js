// COMPONENT: the <video> element - load, frame-exact seek (serialized), frame canvas, fps grid;
// a still picture (png / jpg / webp, 0.2.5) shows in <img id="still"> as a one-frame clip.
import * as F from "./zk_frames.js";

export function createVideo(ctx, hooks) {
  const { cfg, el, state, t } = ctx;
  const video = el.video;
  let seekChain = Promise.resolve();
  let target = 0;

  function once(ev) {
    return new Promise(function (resolve, reject) {
      const timer = setTimeout(function () {
        cleanup();
        reject(new Error(t("timeout", { event: ev })));
      }, cfg.waitTimeoutMs);
      const ok = function (e) {
        cleanup();
        resolve(e);
      };
      const bad = function () {
        cleanup();
        const ve = video.error;
        reject(new Error(ve ? t("videoError", { code: ve.code, message: ve.message }) : t("waitError", { event: ev })));
      };
      const cleanup = function () {
        clearTimeout(timer);
        video.removeEventListener(ev, ok);
        video.removeEventListener("error", bad);
      };
      video.addEventListener(ev, ok, { once: true });
      video.addEventListener("error", bad, { once: true });
    });
  }

  function source(src) {
    if (src instanceof File) {
      return { url: URL.createObjectURL(src), name: src.name };
    }
    if (F.isUrl(src)) {
      return { url: src, name: F.nameFromUrl(src) };
    }
    return { url: F.inputUrl(src), name: F.nameFromInput(src) };
  }

  function setTotal() {
    state.total = F.totalFrames(video.duration, ctx.fps());
    el.scrub.max = String(state.total - 1);
    el.total.textContent = String(state.total - 1);
  }

  function show(still) {
    state.still = still;
    video.style.display = still ? "none" : "";
    el.still.style.display = still ? "" : "none";
  }

  async function loadStill(s) {
    el.still.src = s.url;
    await el.still.decode();
    video.removeAttribute("src");
    show(true);
    state.total = 1;
    el.scrub.max = "0";
    el.total.textContent = "0";
    return { width: el.still.naturalWidth, height: el.still.naturalHeight };
  }

  async function loadVideo(s) {
    show(false);
    video.src = s.url;
    await once("loadedmetadata");
    if (video.readyState < 2) {
      await once("loadeddata");
    }
    setTotal();
    return { width: video.videoWidth, height: video.videoHeight };
  }

  async function load(src) {
    const s = source(src);
    ctx.status(t("loading", { name: s.name }));
    hooks.onClear();
    const size = F.isStill(s.name) ? await loadStill(s) : await loadVideo(s);
    state.name = s.name;
    state.url = s.url;
    state.base = F.safeBase(s.name);
    el.drop.style.display = "none";
    hooks.onSize(size.width, size.height);
    el.name.value = src instanceof File ? "" : String(src);
    ctx.log(state.still ? t("loadedStill", { name: s.name, width: size.width, height: size.height })
      : t("loaded", { name: s.name, width: size.width, height: size.height,
        seconds: video.duration.toFixed(3), total: state.total, fps: ctx.fps().toFixed(3) }));
    await seek(0);
    ctx.status(t("ready"), "ok");
  }

  // Show the frame whose presentation interval contains time; resolve with that frame's mediaTime.
  function presentAt(time) {
    return new Promise(function (resolve) {
      let done = false;
      const finish = function (mt) {
        if (!done) {
          done = true;
          resolve(mt ?? video.currentTime);
        }
      };
      if (Math.abs(video.currentTime - time) < cfg.sameTimeEps && video.readyState >= 2) {
        finish(null);
        return;
      }
      if ("requestVideoFrameCallback" in video) {
        video.requestVideoFrameCallback(function (_now, md) {
          finish(md.mediaTime);
        });
      }
      video.addEventListener("seeked", function () {
        setTimeout(function () {
          finish(null);
        }, cfg.seekedFallbackMs);
      }, { once: true });
      video.currentTime = time;
    });
  }

  async function doSeek(n) {
    if (!state.url) {
      throw new Error(t("noVideo"));
    }
    n = F.clampFrame(n, state.total);
    if (!state.still && !video.paused) {
      video.pause();
    }
    const mt = state.still ? 0 : await presentAt(F.seekTime(n, ctx.fps()));
    state.frame = n;
    state.mediaTime = mt;
    state.shown = state.still ? 0 : F.shownFrame(mt, ctx.fps(), state.total);
    el.scrub.value = String(n);
    el.frame.value = String(n);
    el.tc.textContent = t("time", { seconds: mt.toFixed(3) });
    hooks.onClear();
    state.lastPose = null;
    return { requested: n, shown: state.shown, mediaTime: mt };
  }

  // Seeks are chained so rapid key presses never interleave; target makes fast steps add up.
  function seek(n) {
    if (state.url) {
      target = F.clampFrame(n, state.total);
    }
    const goal = target;
    seekChain = seekChain.then(function () {
      return doSeek(goal);
    }).catch(function (e) {
      ctx.log(t("seekError", { message: e.message }));
    });
    return seekChain;
  }

  function step(d) {
    return seek(target + d);
  }

  function frameCanvas() {
    const src = state.still ? el.still : video;
    const c = document.createElement("canvas");
    c.width = state.still ? el.still.naturalWidth : video.videoWidth;
    c.height = state.still ? el.still.naturalHeight : video.videoHeight;
    c.getContext("2d", { willReadFrequently: true }).drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  async function setFps(str) {
    const f = F.parseFps(str);
    state.fpsNum = f.num;
    state.fpsDen = f.den;
    el.fps.value = `${state.fpsNum}/${state.fpsDen}`;
    if (state.url && !state.still) {
      setTotal();
      await seek(state.frame);
    }
  }

  return { load, seek, step, frameCanvas, setFps };
}
