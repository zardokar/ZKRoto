// LOGICAL (pure): the three tools as one state machine - P pen, V move path, A move point (PenVec modes).
// Ported from Koh's canvas module (cv_tool_pen.js, cv_tool_select.js, cv_tools.js cvHoverKind); no DOM, no
// history stack yet: st = {doc, tool, pen, grab, selected, undone}; tol = {line, point, bend} in doc units.
import * as D from "./zk_pendoc.js";
import { hitTest } from "./zk_penhit.js";
import { applyOut } from "./zk_pencurve.js";
import { insertOnSeg } from "./zk_pensplit.js";
export { selDown, ptDown, selMove } from "./zk_penselect.js";

export const TOOLS = { select: "KeyV", point: "KeyA", pen: "KeyP", zoom: "KeyZ", eyedrop: "KeyI" };

export function newState(doc) {
  return { doc: doc || D.emptyDoc(), tool: "select", pen: null, grab: null, selected: null, undone: [] };
}

function penPath(st) {
  return st.pen ? D.findPath(st.doc, st.pen) : null;
}

// What the mouse is over: point / segment / the first point of the path being drawn (closes it).
export function hoverKind(st, p, tol) {
  const hit = hitTest(st.doc, p, tol.line, tol.point);
  const pen = penPath(st);
  if (!hit) {
    return null;
  }
  if (pen && hit.pathId === pen.id && hit.pointIndex === 0 && pen.points.length > 2) {
    return "first";
  }
  if (st.tool === "pen" && hit.pathId !== (st.pen || st.selected)) {
    return null;
  }
  if (hit.pointIndex !== null && hit.pointIndex !== undefined) {
    return "point";
  }
  return hit.inside ? null : "segment";
}

function penStart(st, p, style) {
  if (!st.pen) {
    const path = D.addPath(st.doc, Object.assign({ kind: "poly" }, style || {}));
    st.pen = path.id;
    st.selected = path.id;
    st.undone = [];
  }
  const path = penPath(st);
  const point = { x: p.x, y: p.y };
  applyOut(st, path, point);
  path.points.push(point);
  st.grab = { x: p.x, y: p.y, index: path.points.length - 1, path: path.id };
}

// Click on a point = remove it; fewer than two points left means no shape, so the whole path goes.
function penErase(st, pathId, index) {
  const path = D.findPath(st.doc, pathId);
  st.active = null;
  if (!path) {
    return;
  }
  if (path.points.length <= 2) {
    D.deletePath(st.doc, pathId);
    if (st.pen === pathId) {
      st.pen = null;
    }
    st.selected = null;
    return;
  }
  D.removePoint(st.doc, pathId, index);
}

export function penDown(st, p, ev, tol, style) {
  const hit = hitTest(st.doc, p, tol.line, tol.point);
  const kind = hoverKind(st, p, tol);
  if (kind === "first") {
    applyOut(st, penPath(st), penPath(st).points[0]);
    penPath(st).closed = true;
    penFinish(st);
  } else if (kind === "point" && ev && ev.altKey) {
    st.grab = { x: p.x, y: p.y, index: hit.pointIndex, path: hit.pathId, bend: true };
  } else if (kind === "point") {
    penErase(st, hit.pathId, hit.pointIndex);
  } else if (kind === "segment") {
    insertOnSeg(D.findPath(st.doc, hit.pathId), hit.segIndex, p);
    st.selected = hit.pathId;
  } else {
    penStart(st, p, style);
  }
}

// Both handles mirror each other, so the line in and the line out always join smoothly at that point.
export function penHandles(path, index, p) {
  const cur = path.points[index];
  const prev = path.points[index - 1];
  if (!prev) {
    return;
  }
  path.kind = "bezier";
  if (cur.cx1 === undefined) {
    cur.cx1 = prev.x + (cur.x - prev.x) * 0.35;
    cur.cy1 = prev.y + (cur.y - prev.y) * 0.35;
  }
  cur.cx2 = cur.x - (p.x - cur.x);
  cur.cy2 = cur.y - (p.y - cur.y);
}

export function penMove(st, p, tol) {
  const grab = st.grab;
  if (!grab || grab.index === null || grab.index === undefined) {
    return false;
  }
  if (Math.hypot(p.x - grab.x, p.y - grab.y) < tol.bend) {
    return false;
  }
  const path = D.findPath(st.doc, grab.path);
  if (!path) {
    return false;
  }
  penHandles(path, grab.index, p);
  st.outHandle = { path: path.id, point: path.points[grab.index], x: p.x, y: p.y };
  return true;
}

export function penUp(st) {
  st.grab = null;
}

// An open path is kept as an open line; a single point is dropped.
function bare(colour) {
  return !colour || colour === "none";
}

// Fewer than two points, or an open line with no fill and no stroke (nothing to see; Koh 14:40 "= ลบ"): no shape.
export function penFinish(st) {
  const path = penPath(st);
  if (path && (path.points.length < 2 || (!path.closed && bare(path.fill) && bare(path.stroke)))) {
    D.deletePath(st.doc, path.id);
    st.selected = st.selected === path.id ? null : st.selected;
  }
  st.pen = null;
  st.grab = null;
  st.outHandle = null;
  st.undone = [];
  return !!path;
}

// Esc = drop the whole line being drawn (Illustrator).
export function penCancel(st) {
  if (!st.pen) {
    return false;
  }
  D.deletePath(st.doc, st.pen);
  st.pen = null;
  st.grab = null;
  st.undone = [];
  st.selected = null;
  return true;
}

// Ctrl+Z while drawing steps back ONE point (Koh 2026-08-17); Ctrl+Y puts it back.
export function penStep(st, back) {
  const path = penPath(st);
  if (!path) {
    return false;
  }
  if (!back) {
    const point = st.undone.pop();
    if (point) {
      path.points.push(point);
    }
    return true;
  }
  st.undone.push(path.points.pop());
  if (!path.points.length) {
    penCancel(st);
  }
  return true;
}

// V = move the whole path (drag the line or the filled body); A = move one point of any path.
