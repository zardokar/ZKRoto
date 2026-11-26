// LOGICAL (pure): V and A on the pen doc (Koh's canvas module cv_tool_select.js): V grabs a path by its line or
// filled body and moves it; A grabs one point (it becomes st.active, whose handles A shows). A drag moves by the
// mouse travel, so the point keeps its press offset and never jumps under the cursor (Koh 2026-11-24 14:39).
import * as D from "./zk_pendoc.js";
import { hitPoint, hitPath } from "./zk_penhit.js";
import { moveAnchor } from "./zk_pencurve.js";

export function selDown(st, p, tol) {
  const hit = hitPath(st.doc, p, tol.line);
  st.selected = hit ? hit.pathId : null;
  st.grab = hit ? { x: p.x, y: p.y, index: null, path: hit.pathId } : null;
}

export function ptDown(st, p, tol) {
  const hit = hitPoint(st.doc, p, tol.point);
  st.selected = hit ? hit.pathId : null;
  st.active = hit ? { path: hit.pathId, index: hit.pointIndex } : null;
  st.grab = hit ? { x: p.x, y: p.y, index: hit.pointIndex, path: hit.pathId } : null;
}

export function selMove(st, p) {
  const grab = st.grab;
  if (!grab) {
    return false;
  }
  const dx = p.x - grab.x;
  const dy = p.y - grab.y;
  const path = D.findPath(st.doc, grab.path);
  Object.assign(grab, { x: p.x, y: p.y });
  if (grab.index === null) {
    D.movePath(st.doc, grab.path, dx, dy);
  } else if (path && path.points[grab.index]) {
    moveAnchor(path, grab.index, { x: path.points[grab.index].x + dx, y: path.points[grab.index].y + dy });
  }
  return true;
}
