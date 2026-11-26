// COMPONENT: zoom / pan of the source picture on the page (canvas module cv_stage.js cvZoomAt, cv_stage_pointer.js
// cvOnWheel). One CSS transform on the video, the still, the pose overlay and the pen canvas together, so every
// click maps through getBoundingClientRect as before. The wheel zooms at the mouse with any tool.
import { fitView, zoomAt, panBy as pan, viewCss, viewPercent } from "./zk_view.js";
import { rgbToHex } from "./zk_hsv.js";

const LAYERS = ["video", "still", "overlay"];

export function createPenView(ctx) {
  const { cfg, el } = ctx;
  const lim = { min: cfg.pen.zoomMin, max: cfg.pen.zoomMax };
  let v = fitView();
  const watchers = [];

  function apply() {
    for (const name of LAYERS) {
      el[name].style.transform = viewCss(v);
      el[name].style.transformOrigin = "50% 50%";
    }
    for (const fn of watchers) {
      fn(v);
    }
  }

  // The picture as now on screen (zoomed / panned): the still when it is shown, else the video.
  function box() {
    const shown = el.still.style.display === "none" ? el.video : el.still;
    return shown.getBoundingClientRect();
  }

  // The pen canvas covers the pane at screen pixels x devicePixelRatio: sharp at any zoom (Koh 13:57).
  function backing(canvas) {
    const r = el.srcpane.getBoundingClientRect();
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { dpr, left: r.left, top: r.top };
  }

  function zoomAtClient(x, y, factor) {
    const r = box();
    v = zoomAt(v, { x: x - (r.left + r.width / 2), y: y - (r.top + r.height / 2) }, factor, lim);
    apply();
    return v;
  }

  // The zoom bar's - and +: zoom at the middle of the source pane (canvas cvZoomCenter).
  function zoomCenter(factor) {
    const r = el.srcpane.getBoundingClientRect();
    return zoomAtClient(r.left + r.width / 2, r.top + r.height / 2, factor);
  }

  // Eyedropper (canvas cvSampleRef): the picture's colour at picture pixel (x, y), from the still or the video frame.
  function sample(x, y) {
    const src = el.still.style.display === "none" ? el.video : el.still;
    const w = src.naturalWidth || src.videoWidth;
    const h = src.naturalHeight || src.videoHeight;
    if (!w || x < 0 || y < 0 || x >= w || y >= h) {
      return null;
    }
    const pad = document.createElement("canvas");
    pad.width = 1;
    pad.height = 1;
    const g = pad.getContext("2d");
    g.drawImage(src, Math.floor(x), Math.floor(y), 1, 1, 0, 0, 1, 1);
    try {
      const px = g.getImageData(0, 0, 1, 1).data;
      return rgbToHex({ r: px[0], g: px[1], b: px[2] });
    } catch (err) {
      return null;
    }
  }

  function panBy(dx, dy) {
    v = pan(v, dx, dy);
    apply();
    return v;
  }

  function fit() {
    v = fitView();
    apply();
    return v;
  }

  // The pane changes size (window, panel, view switch): the sharp pen canvas is drawn again.
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(apply).observe(el.srcpane);
  }

  el.srcpane.addEventListener("wheel", function (e) {
    e.preventDefault();
    zoomAtClient(e.clientX, e.clientY, e.deltaY < 0 ? cfg.pen.zoomWheel : 1 / cfg.pen.zoomWheel);
  }, { passive: false });

  return { zoomAtClient, zoomCenter, panBy, fit, sample, box, backing, view: function () {
    return v;
  }, percent: function () {
    return viewPercent(v);
  }, onChange: function (fn) {
    watchers.push(fn);
  } };
}
