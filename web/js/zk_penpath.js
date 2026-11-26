// LOGICAL (pure): path geometry - SVG path data, the Bezier contract, point-to-curve distance, point in path.
// Ported from Koh's canvas module (E:\LocalLLMAdvisorClaudeProject\pipeline\module\canvas\web\js\cv_path.js):
// same rules - a point with cx1/cy1/cx2/cy2 on a "bezier" path is a cubic C segment, otherwise L.
export const BEZIER_STEPS = 16;
const HANDLE_KEYS = ["cx1", "cy1", "cx2", "cy2"];
const EPS = 1e-9;

export function num(value) {
  const text = Number(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return text === "" || text === "-0" ? "0" : text;
}

export function hasHandles(point) {
  return HANDLE_KEYS.every((k) => point[k] !== undefined);
}

function segD(cur, kind) {
  if (kind === "bezier" && hasHandles(cur)) {
    return "C" + num(cur.cx1) + " " + num(cur.cy1) + " " + num(cur.cx2) + " " +
      num(cur.cy2) + " " + num(cur.x) + " " + num(cur.y);
  }
  return "L" + num(cur.x) + " " + num(cur.y);
}

export function pathD(path) {
  const pts = path.points || [];
  if (pts.length < 2) {
    return "";
  }
  const out = ["M" + num(pts[0].x) + " " + num(pts[0].y)];
  for (let i = 1; i < pts.length; i += 1) {
    out.push(segD(pts[i], path.kind));
  }
  if (path.closed) {
    out.push(segD(pts[0], path.kind));
    out.push("Z");
  }
  return out.join(" ");
}

export function segDist(p, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

export function cubicAt(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function segPoints(prev, cur, kind, steps) {
  if (kind !== "bezier" || !hasHandles(cur)) {
    return [{ x: cur.x, y: cur.y }];
  }
  const p1 = { x: cur.cx1, y: cur.cy1 };
  const p2 = { x: cur.cx2, y: cur.cy2 };
  const out = [];
  for (let i = 1; i <= steps; i += 1) {
    out.push(cubicAt(prev, p1, p2, cur, i / steps));
  }
  return out;
}

function same(a, b) {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (last && same(p, last)) {
      continue;
    }
    out.push(p);
  }
  while (out.length > 1 && same(out[0], out[out.length - 1])) {
    out.pop();
  }
  return out;
}

// The line you SEE is the curve, so hits are measured against the flattened curve, not the chords.
export function flattenPath(path, steps) {
  const pts = (path && path.points) || [];
  const n = steps || BEZIER_STEPS;
  if (!pts.length) {
    return [];
  }
  const kind = path.kind || "poly";
  let out = [{ x: pts[0].x, y: pts[0].y }];
  for (let i = 1; i < pts.length; i += 1) {
    out = out.concat(segPoints(pts[i - 1], pts[i], kind, n));
  }
  if (path.closed && pts.length > 2) {
    out = out.concat(segPoints(pts[pts.length - 1], pts[0], kind, n).slice(0, -1));
  }
  return dedupe(out);
}

export function pathDist(path, p, steps) {
  const pts = flattenPath(path, steps);
  if (pts.length < 2) {
    return pts.length === 1 ? Math.hypot(p.x - pts[0].x, p.y - pts[0].y) : Infinity;
  }
  let best = Infinity;
  for (let i = 1; i < pts.length; i += 1) {
    best = Math.min(best, segDist(p, pts[i - 1], pts[i]));
  }
  if (path.closed) {
    best = Math.min(best, segDist(p, pts[pts.length - 1], pts[0]));
  }
  return best;
}

// Click inside the body selects it (PenVec rule: PointIsInPolygon) - horizontal ray cast.
// An open path is filled as if closed by a straight line (SVG / canvas fill), so its body is hit the same way.
export function pointInPath(path, p, steps) {
  if (!path) {
    return false;
  }
  const pts = flattenPath(path, steps);
  if (pts.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const yi = pts[i].y;
    const yj = pts[j].y;
    if ((yi > p.y) === (yj > p.y)) {
      continue;
    }
    const x = (pts[j].x - pts[i].x) * (p.y - yi) / (yj - yi) + pts[i].x;
    if (p.x < x) {
      inside = !inside;
    }
  }
  return inside;
}
