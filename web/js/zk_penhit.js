// LOGICAL (pure): what a click hits - a point, then the line you see, then the filled body. Topmost wins.
// Ported from Koh's canvas module (pipeline\module\canvas\web\js\cv_hit.js); PenVec 2012 rule: select a body
// with point-in-polygon, not by distance to its outline. A path with fill "none" is hit on its line only.
import { pathDist, pointInPath } from "./zk_penpath.js";
import { nearestOnPath } from "./zk_pensplit.js";

function hittable(doc) {
  return doc.paths.filter((p) => p.visible !== false && p.locked !== true);
}

export function hitPoint(doc, p, tol) {
  const list = hittable(doc);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const path = list[i];
    for (let j = 0; j < path.points.length; j += 1) {
      if (Math.hypot(p.x - path.points[j].x, p.y - path.points[j].y) <= tol) {
        return { pathId: path.id, pointIndex: j };
      }
    }
  }
  return null;
}

function filled(path) {
  return !!path.fill && path.fill !== "none";
}

export function hitPath(doc, p, tol) {
  const list = hittable(doc);
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const path = list[i];
    if (pathDist(path, p) <= tol) {
      return { pathId: path.id, pointIndex: null, segIndex: nearestOnPath(path, p).seg };
    }
    if (filled(path) && pointInPath(path, p)) {
      return { pathId: path.id, pointIndex: null, segIndex: null, inside: true };
    }
  }
  return null;
}

// A point always beats a line and has its own, larger tolerance: points are small but must be easy to grab.
export function hitTest(doc, p, tol, pointTol) {
  return hitPoint(doc, p, pointTol || tol) || hitPath(doc, p, tol);
}
