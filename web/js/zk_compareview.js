// LOGICAL (pure): the one view both compare pictures share (Koh voice 2026-11-24 16:0x: side by side and wipe,
// zoom / pan move both). v = {k, ox, oy}: picture point p is drawn at p * k + o. The wipe w (0..1) is the share of
// the box that shows the before picture, from the left (rgthree Image Comparer / ComfyUI Compare Images).

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

export function fitView(imgW, imgH, boxW, boxH) {
  const k = Math.min(boxW / imgW, boxH / imgH);
  return { k, ox: (boxW - imgW * k) / 2, oy: (boxH - imgH * k) / 2 };
}

export function zoomAt(v, f, x, y, lim) {
  const k = clamp(v.k * f, lim.min, lim.max);
  return { k, ox: x - ((x - v.ox) / v.k) * k, oy: y - ((y - v.oy) / v.k) * k };
}

export function panBy(v, dx, dy) {
  return { k: v.k, ox: v.ox + dx, oy: v.oy + dy };
}

export function css(v) {
  return "translate(" + v.ox + "px, " + v.oy + "px) scale(" + v.k + ")";
}

export function wipeAt(clientX, left, width) {
  return clamp((clientX - left) / width, 0, 1);
}

export function wipeKey(w, code, step) {
  const d = { ArrowLeft: -step, ArrowRight: step }[code] || 0;
  return Math.round(clamp(w + d, 0, 1) * 1000) / 1000;
}
