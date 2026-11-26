// LOGICAL (pure): curves with A, the Illustrator Direct Selection way (Koh 2026-11-24 14:20 / 14:26): the chosen
// point (st.active) shows its in / out handles (in = cx2 of the point, out = cx1 of the next point, cv_path.js
// contract); drag a handle = bend (the other turns opposite, Alt = alone); Alt+drag on a point pulls handles out.
import * as D from "./zk_pendoc.js";
import { hitPoint } from "./zk_penhit.js";
import { hasHandles } from "./zk_penpath.js";

const SMOOTH_COS = 0.998;

function nextIndex(path, i) {
  return i + 1 < path.points.length ? i + 1 : (path.closed ? 0 : -1);
}

function prevIndex(path, i) {
  return i > 0 ? i - 1 : (path.closed ? path.points.length - 1 : -1);
}

export function handlesOf(path, i) {
  const cur = path.points[i];
  if (!cur) {
    return { in: null, out: null };
  }
  const next = path.points[nextIndex(path, i)];
  return { in: cur && hasHandles(cur) ? { x: cur.cx2, y: cur.cy2 } : null,
    out: next && hasHandles(next) ? { x: next.cx1, y: next.cy1 } : null };
}

// A missing side is shown mirrored (Illustrator shows both arms of a smooth point; Koh 14:30); dragging it makes it.
export function shownHandles(path, i) {
  const h = handlesOf(path, i);
  const cur = path.points[i];
  const mirror = (q) => ({ x: 2 * cur.x - q.x, y: 2 * cur.y - q.y });
  if (!h.out && h.in && nextIndex(path, i) >= 0) {
    h.out = mirror(h.in);
  } else if (!h.in && h.out && prevIndex(path, i) >= 0) {
    h.in = mirror(h.out);
  }
  return h;
}

// The out arm dragged with P becomes the first handle of the next segment (target = its end point).
export function applyOut(st, path, target) {
  const o = st.outHandle;
  st.outHandle = null;
  const last = path.points[path.points.length - 1];
  if (!o || o.path !== path.id || o.point !== last || !target || hasHandles(target)) {
    return;
  }
  path.kind = "bezier";
  Object.assign(target, { cx1: o.x, cy1: o.y, cx2: target.x, cy2: target.y });
}

// A straight segment ending at point i gets handles on its thirds first (it stays straight until bent).
function ensure(path, i) {
  const cur = path.points[i];
  const prev = path.points[prevIndex(path, i)];
  if (!cur || !prev || hasHandles(cur)) {
    return;
  }
  Object.assign(cur, { cx1: prev.x + (cur.x - prev.x) / 3, cy1: prev.y + (cur.y - prev.y) / 3,
    cx2: cur.x - (cur.x - prev.x) / 3, cy2: cur.y - (cur.y - prev.y) / 3 });
}

function setHandle(path, i, which, q) {
  const k = which === "in" ? i : nextIndex(path, i);
  if (k < 0 || (which === "in" && prevIndex(path, i) < 0)) {
    return;
  }
  ensure(path, k);
  path.kind = "bezier";
  path.points[k][which === "in" ? "cx2" : "cx1"] = q.x;
  path.points[k][which === "in" ? "cy2" : "cy1"] = q.y;
}

// The other handle on the opposite side of the point, keeping its own length (a smooth point).
function opposite(anchor, q, other) {
  const len = other ? Math.hypot(other.x - anchor.x, other.y - anchor.y) : Math.hypot(q.x - anchor.x, q.y - anchor.y);
  const d = Math.hypot(q.x - anchor.x, q.y - anchor.y) || 1;
  return { x: anchor.x - (q.x - anchor.x) * len / d, y: anchor.y - (q.y - anchor.y) * len / d };
}

export function curveDown(st, p, ev, tol) {
  const a = st.active;
  const path = a && a.path === st.selected ? D.findPath(st.doc, a.path) : null;
  if (path && path.points[a.index]) {
    const h = shownHandles(path, a.index);
    const near = ["out", "in"].find((w) => h[w] && Math.hypot(h[w].x - p.x, h[w].y - p.y) <= tol.point);
    if (near) {
      st.grab = { x: p.x, y: p.y, index: a.index, path: a.path, curve: near };
      return true;
    }
  }
  const hit = ev && ev.altKey ? hitPoint(st.doc, p, tol.point) : null;
  if (!hit) {
    return false;
  }
  st.selected = hit.pathId;
  st.active = { path: hit.pathId, index: hit.pointIndex };
  st.grab = { x: p.x, y: p.y, index: hit.pointIndex, path: hit.pathId, curve: "pull" };
  return true;
}

// Smooth = both arms on one line through the anchor (or one arm missing); a corner keeps its corner when one arm
// moves (Illustrator / Affinity; Koh 23:3x "แขนที่มันหักมุม ... กลับเหมือนเดิม").
export function isSmooth(path, i) {
  const h = handlesOf(path, i);
  const a = path.points[i];
  if (!h.in || !h.out) {
    return true;
  }
  const u = { x: a.x - h.in.x, y: a.y - h.in.y };
  const v = { x: h.out.x - a.x, y: h.out.y - a.y };
  const lu = Math.hypot(u.x, u.y);
  const lv = Math.hypot(v.x, v.y);
  return !lu || !lv || (u.x * v.x + u.y * v.y) / (lu * lv) > SMOOTH_COS;
}

export function curveMove(st, p, ev) {
  const g = st.grab;
  const path = g && g.curve ? D.findPath(st.doc, g.path) : null;
  if (!path || !path.points[g.index]) {
    return false;
  }
  const anchor = path.points[g.index];
  const which = g.curve === "in" ? "in" : "out";
  const other = which === "in" ? "out" : "in";
  if (g.smooth === undefined) {
    g.smooth = isSmooth(path, g.index);
  }
  const smooth = g.smooth;
  setHandle(path, g.index, which, p);
  if (g.curve === "pull" || (smooth && !(ev && ev.altKey))) {
    setHandle(path, g.index, other, opposite(anchor, p, g.curve === "pull" ? null : handlesOf(path, g.index)[other]));
  }
  return true;
}

// A moves a point with its two handles (they belong to it).
export function moveAnchor(path, i, p) {
  const cur = path.points[i];
  const dx = p.x - cur.x;
  const dy = p.y - cur.y;
  const next = path.points[nextIndex(path, i)];
  cur.x = p.x;
  cur.y = p.y;
  if (hasHandles(cur)) {
    cur.cx2 += dx;
    cur.cy2 += dy;
  }
  if (next && hasHandles(next)) {
    next.cx1 += dx;
    next.cy1 += dy;
  }
}
