// LOGICAL (pure): the V transform gesture on the chosen shape (canvas cv_transform_overlay.js cvTransformHandles /
// cvTransformHit, cv_tool_transform.js): 8 handles + rotate handle above the box; every preview comes from the
// points saved at the press (no drift); Esc / tool switch restore them. tol (canvas pixels) = { hit, rotate, min, snap }.
import * as M from "./zk_transform.js";
import { findPath, setPoints } from "./zk_pendoc.js";

function chosen(st) {
  const path = st.selected ? findPath(st.doc, st.selected) : null;
  return path && path.visible !== false && path.locked !== true ? path : null;
}

function handles(box, tol) {
  const out = [];
  for (const y of [-1, 0, 1]) {
    for (const x of [-1, 0, 1]) {
      if (x || y) {
        out.push({ x: box.x + (x + 1) * box.w / 2, y: box.y + (y + 1) * box.h / 2, handle: [x, y] });
      }
    }
  }
  out.push({ x: box.x + box.w / 2, y: box.y - tol.rotate, handle: "rotate" });
  return out;
}

export function handlesOf(st, tol) {
  const box = chosen(st) ? M.bounds(chosen(st)) : null;
  return box ? handles(box, tol) : [];
}

// The nearest handle within tol.hit, else inside the box = move, else nothing.
export function tfHit(st, p, tol) {
  const box = chosen(st) ? M.bounds(chosen(st)) : null;
  if (!box) {
    return null;
  }
  const near = handles(box, tol).map((h) => ({ ...h, d: Math.hypot(h.x - p.x, h.y - p.y) }))
    .sort((a, b) => a.d - b.d).find((h) => h.d <= tol.hit);
  if (near) {
    return { box, ...near };
  }
  const inside = p.x >= box.x && p.x <= box.x + box.w && p.y >= box.y && p.y <= box.y + box.h;
  return inside ? { box, handle: "move" } : null;
}

export function tfDown(st, p, tol) {
  const hit = tfHit(st, p, tol);
  if (!hit) {
    return false;
  }
  const path = chosen(st);
  st.grab = { x: p.x, y: p.y, index: null, path: path.id };
  if (hit.handle !== "move") {
    const center = { x: hit.box.x + hit.box.w / 2, y: hit.box.y + hit.box.h / 2 };
    Object.assign(st.grab, { transform: hit.handle, box: hit.box, center, handleStart: { x: hit.x, y: hit.y },
      angleStart: Math.atan2(p.y - center.y, p.x - center.x), start: JSON.parse(JSON.stringify(path.points)),
      matrix: null });
  }
  return true;
}

export function tfMove(st, p, ev, tol) {
  const g = st.grab;
  if (!g || !g.transform) {
    return false;
  }
  if (p.x === g.x && p.y === g.y) {
    g.matrix = null;
    setPoints(st.doc, g.path, g.start);
    return true;
  }
  if (g.transform === "rotate") {
    let angle = Math.atan2(p.y - g.center.y, p.x - g.center.x) - g.angleStart;
    if (ev && ev.shiftKey) {
      const snap = tol.snap * Math.PI / 180;
      angle = Math.round(angle / snap) * snap;
    }
    g.matrix = M.rotate(g.center, angle);
  } else {
    const target = { x: g.handleStart.x + p.x - g.x, y: g.handleStart.y + p.y - g.y };
    g.matrix = M.resize(g.box, g.transform, target, !!(ev && ev.shiftKey), tol.min);
  }
  setPoints(st.doc, g.path, M.mapPoints(g.start, g.matrix));
  return true;
}

// Esc, a tool switch or a lost window: the shape goes back to the points of the press.
export function tfCancel(st) {
  const g = st.grab;
  if (!g || !g.transform) {
    return false;
  }
  setPoints(st.doc, g.path, g.start);
  st.grab = null;
  return true;
}
