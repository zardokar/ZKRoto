// LOGICAL (pure): zoom / pan of the source picture, the rules of the canvas module (cv_data.js cvZoomView, cvPanView,
// cvFitView): a view {s, tx, ty} = CSS translate(tx, ty) scale(s) about the picture centre; zoom keeps the point
// under the mouse in place; s is clamped to [min, max] (CV_ZOOM_MIN 0.05, CV_ZOOM_MAX 40).

export function fitView() {
  return { s: 1, tx: 0, ty: 0 };
}

// off = mouse minus the picture centre as now on screen (screen pixels).
export function zoomAt(v, off, factor, lim) {
  const s = Math.min(lim.max, Math.max(lim.min, v.s * factor));
  const keep = 1 - s / v.s;
  return { s, tx: v.tx + off.x * keep, ty: v.ty + off.y * keep };
}

export function panBy(v, dx, dy) {
  return { s: v.s, tx: v.tx + dx, ty: v.ty + dy };
}

// The zoom bar's number: 100% = the picture fitted to the stage (canvas cvZoomPercent: page fitted = its 100).
export function viewPercent(v) {
  return Math.round(v.s * 100);
}

export function viewCss(v) {
  return `translate(${v.tx}px, ${v.ty}px) scale(${v.s})`;
}
