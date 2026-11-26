// LOGICAL (pure): insert a point on the line you see (Koh 2026-11-24 14:39). The nearest place is found on the
// curve itself, then a cubic is split in two at that place (de Casteljau), so the shape does not change; a
// straight segment gets the point projected onto it. Bezier contract of zk_penpath.js (handles = segment into i).
import { hasHandles, cubicAt } from "./zk_penpath.js";

const SAMPLES = 32;
const REFINE = 24;
const END = 1e-3;

function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function ends(path, seg) {
  const pts = path.points;
  return { a: pts[seg - 1], b: seg < pts.length ? pts[seg] : pts[0] };
}

function curved(path, b) {
  return path.kind === "bezier" && hasHandles(b);
}

function at(path, seg, t) {
  const { a, b } = ends(path, seg);
  if (!curved(path, b)) {
    return lerp(a, b, t);
  }
  return cubicAt(a, { x: b.cx1, y: b.cy1 }, { x: b.cx2, y: b.cy2 }, b, t);
}

// A straight segment: the exact projection; a cubic: coarse samples, then a shrinking search around the best one.
function nearestT(path, seg, p) {
  const { a, b } = ends(path, seg);
  if (!curved(path, b)) {
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
    const t = Math.min(1, Math.max(0, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
    const q = lerp(a, b, t);
    return { t, dist: Math.hypot(q.x - p.x, q.y - p.y) };
  }
  const dist = (t) => {
    const q = at(path, seg, t);
    return Math.hypot(q.x - p.x, q.y - p.y);
  };
  let best = 0;
  for (let i = 1; i <= SAMPLES; i += 1) {
    best = dist(i / SAMPLES) < dist(best) ? i / SAMPLES : best;
  }
  let step = 1 / SAMPLES;
  for (let i = 0; i < REFINE; i += 1) {
    step /= 2;
    const lo = Math.max(0, best - step);
    const hi = Math.min(1, best + step);
    best = [lo, best, hi].reduce((m, t) => (dist(t) < dist(m) ? t : m), best);
  }
  return { t: best, dist: dist(best) };
}

export function nearestOnPath(path, p) {
  const n = (path.points || []).length;
  const last = path.closed && n > 2 ? n : n - 1;
  let best = null;
  for (let seg = 1; seg <= last; seg += 1) {
    const got = nearestT(path, seg, p);
    if (!best || got.dist < best.dist) {
      best = { seg, t: got.t, dist: got.dist };
    }
  }
  return best;
}

function splitCubic(path, seg, t) {
  const { a, b } = ends(path, seg);
  const p1 = { x: b.cx1, y: b.cy1 };
  const p2 = { x: b.cx2, y: b.cy2 };
  const p01 = lerp(a, p1, t);
  const p12 = lerp(p1, p2, t);
  const p23 = lerp(p2, b, t);
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);
  const mid = lerp(p012, p123, t);
  Object.assign(b, { cx1: p123.x, cy1: p123.y, cx2: p23.x, cy2: p23.y });
  return { x: mid.x, y: mid.y, cx1: p01.x, cy1: p01.y, cx2: p012.x, cy2: p012.y };
}

// Returns the index of the new point (the closing segment puts it at the end).
export function insertOnSeg(path, seg, p) {
  const n = path.points.length;
  if (seg < 1 || seg > n || (seg === n && !path.closed)) {
    return null;
  }
  const { t } = nearestT(path, seg, p);
  if (t < END || t > 1 - END) {
    return null;
  }
  const { b } = ends(path, seg);
  const q = at(path, seg, t);
  const point = curved(path, b) ? splitCubic(path, seg, t) : { x: q.x, y: q.y };
  path.points.splice(seg, 0, point);
  return seg;
}
