// VIEW (no DOM, a 2D context only): draws the pen doc as Koh's canvas overlay does (cv_overlay.js): paths, the
// chosen path's points white with a dark ring, a dashed guide from the last point to the mouse while drawing.
// zoom = canvas pixels per screen pixel: every size is screen pixels x zoom, colours are not (cv_overlay docs).
import { hasHandles } from "./zk_penpath.js";
import { findPath } from "./zk_pendoc.js";
import { handlesOf } from "./zk_pentransform.js";
import { shownHandles } from "./zk_pencurve.js";
import { mapPoint } from "./zk_transform.js";

// Real cubics on the canvas (canvas cv_render.js draws pathD); flattening is for hit tests only (Koh 14:31).
function segTo(g, cur, kind) {
  if (kind === "bezier" && hasHandles(cur)) {
    g.bezierCurveTo(cur.cx1, cur.cy1, cur.cx2, cur.cy2, cur.x, cur.y);
  } else {
    g.lineTo(cur.x, cur.y);
  }
}

export function trace(g, path) {
  const pts = path.points || [];
  g.beginPath();
  if (!pts.length) {
    return;
  }
  g.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach((q) => segTo(g, q, path.kind));
  if (path.closed && pts.length > 1) {
    segTo(g, pts[0], path.kind);
    g.closePath();
  }
}

// fill_opacity / stroke_opacity as in SVG; no key = full (canvas cv_render.js cvOpAttr).
function opacity(value) {
  return value === undefined ? 1 : value;
}

// SVG fills an open path as if closed; canvas fill() does the same, the stroke stays open (cv_render.js).
function drawPath(g, path, zoom) {
  if (path.visible === false || path.points.length < 1) {
    return;
  }
  trace(g, path);
  if (path.fill && path.fill !== "none") {
    g.globalAlpha = opacity(path.fill_opacity);
    g.fillStyle = path.fill;
    g.fill();
  }
  g.globalAlpha = opacity(path.stroke_opacity);
  g.strokeStyle = path.stroke && path.stroke !== "none" ? path.stroke : "transparent";
  g.lineWidth = (path.stroke_width || 1) * zoom;
  g.stroke();
  g.globalAlpha = 1;
}

// Canvas rule 23: the line being drawn is always seen (a thin guide-colour line), whatever its stroke is.
function drawSketch(g, path, look, zoom) {
  trace(g, path);
  g.strokeStyle = look.guideColor;
  g.lineWidth = look.guideWidthPx * zoom;
  g.stroke();
}

// A: the chosen point's handles - a guide line from the point to each handle end, a small ring at the end.
function drawHandles(g, st, path, look, zoom) {
  const a = st.tool === "point" && st.active && st.active.path === path.id && path.points[st.active.index] ?
    st.active : null;
  const h = a ? shownHandles(path, a.index) : {};
  g.fillStyle = look.pointFill;
  for (const end of [h.in, h.out].filter(Boolean)) {
    // Dark under white, as the points are drawn, so the arm shows on any fill or picture (Koh 15:33).
    for (const [colour, width] of [[look.pointStroke, look.armHaloPx], [look.pointFill, look.armWidthPx]]) {
      g.strokeStyle = colour;
      g.lineWidth = width * zoom;
      g.beginPath();
      g.moveTo(path.points[a.index].x, path.points[a.index].y);
      g.lineTo(end.x, end.y);
      g.stroke();
    }
    g.lineWidth = look.pointStrokePx * zoom;
    g.strokeStyle = look.pointStroke;
    g.beginPath();
    g.arc(end.x, end.y, look.pointSizePx * 0.7 * zoom, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}

function drawPoints(g, path, look, zoom) {
  g.lineWidth = look.pointStrokePx * zoom;
  g.fillStyle = look.pointFill;
  g.strokeStyle = look.pointStroke;
  for (const q of path.points) {
    g.beginPath();
    g.arc(q.x, q.y, look.pointSizePx * zoom, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}

function drawGuide(g, from, to, look, zoom) {
  g.strokeStyle = look.guideColor;
  g.lineWidth = look.guideWidthPx * zoom;
  g.setLineDash([look.guideDashPx * zoom, look.guideGapPx * zoom]);
  g.beginPath();
  g.moveTo(from.x, from.y);
  g.lineTo(to.x, to.y);
  g.stroke();
  g.setLineDash([]);
}

// V: the transform box (cv_transform_overlay.js cvTransformOverlay); while rotating, the box of the press turned.
function drawTransform(g, st, look, zoom) {
  const grab = st.grab && st.grab.transform === "rotate" && st.grab.matrix ? st.grab : null;
  let hs = handlesOf(st, { rotate: look.transformRotatePx * zoom });
  if (grab) {
    hs = handlesOf({ doc: { paths: [{ id: "b", points: boxPoints(grab.box) }] }, selected: "b" },
      { rotate: look.transformRotatePx * zoom }).map((h) => mapPoint(h, grab.matrix));
  }
  if (hs.length < 9) {
    return;
  }
  g.strokeStyle = look.guideColor;
  g.lineWidth = look.guideWidthPx * zoom;
  g.beginPath();
  [0, 2, 7, 5, 0].forEach((i, n) => (n ? g.lineTo(hs[i].x, hs[i].y) : g.moveTo(hs[i].x, hs[i].y)));
  g.moveTo(hs[1].x, hs[1].y);
  g.lineTo(hs[8].x, hs[8].y);
  g.stroke();
  g.fillStyle = look.pointFill;
  for (const h of hs) {
    g.beginPath();
    g.arc(h.x, h.y, look.transformHandlePx * zoom, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
}

function boxPoints(b) {
  return [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h }];
}

export function drawPen(g, st, mouse, look, zoom, size) {
  g.clearRect(0, 0, size.w, size.h);
  for (const path of st.doc.paths) {
    drawPath(g, path, zoom);
  }
  const chosen = st.tool && st.selected ? findPath(st.doc, st.selected) : null;
  if (chosen && chosen.visible !== false && st.tool === "select" && !st.pen) {
    drawTransform(g, st, look, zoom);
  } else if (chosen && chosen.visible !== false) {
    drawPoints(g, chosen, look, zoom);
    drawHandles(g, st, chosen, look, zoom);
  }
  const open = st.pen ? findPath(st.doc, st.pen) : null;
  if (open && open.points.length > 1) {
    drawSketch(g, open, look, zoom);
  }
  if (open && open.points.length && mouse) {
    drawGuide(g, open.points[open.points.length - 1], mouse, look, zoom);
  }
}
