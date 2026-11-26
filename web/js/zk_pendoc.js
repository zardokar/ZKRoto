// LOGICAL (pure): the pen document and its receivers (add / find / move point / move path / insert / remove).
// Ported from Koh's canvas module (pipeline\module\canvas\web\js\cv_doc.js), flattened to one list of paths:
// ZKRoto has no layers or groups yet. Receivers change the doc in place and return the path (or null).
import { hasHandles } from "./zk_penpath.js";

export const PEN_VERSION = 1;
const PATH_DEFAULTS = { kind: "poly", closed: false, fill: "none", stroke: "#62120d", stroke_width: 2 };

export function emptyDoc() {
  return { version: PEN_VERSION, seq: 0, paths: [] };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function addPath(doc, spec) {
  doc.seq += 1;
  const item = Object.assign({ id: "p" + doc.seq, points: [] }, PATH_DEFAULTS, spec || {});
  doc.paths.push(item);
  return item;
}

export function findPath(doc, id) {
  return doc.paths.find((p) => p.id === id) || null;
}

export function deletePath(doc, id) {
  const index = doc.paths.findIndex((p) => p.id === id);
  if (index < 0) {
    return false;
  }
  doc.paths.splice(index, 1);
  return true;
}

export function updatePoint(doc, id, index, x, y) {
  const path = findPath(doc, id);
  if (!path || !path.points[index]) {
    return null;
  }
  path.points[index].x = x;
  path.points[index].y = y;
  return path;
}

// Replaces a whole point + the path kind: covers both a point drag and a handle bend with one receiver.
export function setPoint(doc, id, index, point, kind) {
  const path = findPath(doc, id);
  if (!path || !path.points[index]) {
    return false;
  }
  path.points[index] = clone(point);
  path.kind = kind || path.kind;
  return true;
}

export function setPoints(doc, id, points) {
  const path = findPath(doc, id);
  if (!path) {
    return false;
  }
  path.points = clone(points);
  return true;
}

export function movePath(doc, id, dx, dy) {
  const path = findPath(doc, id);
  if (!path) {
    return null;
  }
  for (const point of path.points) {
    point.x += dx;
    point.y += dy;
    if (hasHandles(point)) {
      point.cx1 += dx;
      point.cy1 += dy;
      point.cx2 += dx;
      point.cy2 += dy;
    }
  }
  return path;
}

// Pen click on a line = a new point there; index is the end point of the segment that was hit.
export function insertPoint(doc, id, index, point) {
  const path = findPath(doc, id);
  if (!path || index < 1 || index > path.points.length) {
    return null;
  }
  path.points.splice(index, 0, clone(point));
  return path;
}

// Removes the POINT only; a path left with fewer than two points is the caller's job (it deletes the path).
export function removePoint(doc, id, index) {
  const path = findPath(doc, id);
  if (!path || !path.points[index]) {
    return false;
  }
  path.points.splice(index, 1);
  return true;
}

export function checkDoc(doc) {
  const bad = [];
  if (!doc || doc.version !== PEN_VERSION || !Array.isArray(doc.paths)) {
    return ["not a pen doc v" + PEN_VERSION];
  }
  for (const p of doc.paths) {
    const ok = p.points.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
    if (!ok) {
      bad.push(p.id + ": point not a number");
    }
  }
  return bad;
}
