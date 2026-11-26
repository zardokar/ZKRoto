// LOGICAL (pure): affine geometry of the V transform box, ported from Koh's canvas module (cv_transform_math.js,
// docs/cv_transform.js.md): bounds with the real cubic extrema, resize about the fixed opposite handle (Shift =
// keep the ratio), rotate about a centre; every anchor and every cubic control point is mapped together.
import { hasHandles } from "./zk_penpath.js";

function roots(a, b, c, d) {
  const qa = -a + 3 * b - 3 * c + d;
  const qb = 2 * (a - 2 * b + c);
  const qc = b - a;
  if (Math.abs(qa) < Number.EPSILON) {
    return qb ? [-qc / qb] : [];
  }
  const disc = qb * qb - 4 * qa * qc;
  return disc < 0 ? [] : [(-qb + Math.sqrt(disc)) / (2 * qa), (-qb - Math.sqrt(disc)) / (2 * qa)];
}

function curveAt(a, b, c, d, t) {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

function extrema(path, xs, ys) {
  const pts = path.points;
  const count = path.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (path.kind !== "bezier" || !hasHandles(b)) {
      continue;
    }
    for (const axis of ["x", "y"]) {
      const v = [a[axis], b["c" + axis + "1"], b["c" + axis + "2"], b[axis]];
      for (const t of roots(...v)) {
        if (t > 0 && t < 1) {
          (axis === "x" ? xs : ys).push(curveAt(...v, t));
        }
      }
    }
  }
}

export function bounds(path) {
  const pts = (path && path.points) || [];
  if (!pts.length) {
    return null;
  }
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  extrema(path, xs, ys);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// handle = [hx, hy] in -1 / 0 / 1; crossing the fixed anchor clamps (min size), it never mirrors.
export function resize(box, handle, p, lock, minimum) {
  const [hx, hy] = handle;
  const anchor = { x: box.x + (hx < 0 ? box.w : hx > 0 ? 0 : box.w / 2),
    y: box.y + (hy < 0 ? box.h : hy > 0 ? 0 : box.h / 2) };
  let sx = hx && box.w ? Math.max(Math.min(minimum, box.w), hx * (p.x - anchor.x)) / box.w : 1;
  let sy = hy && box.h ? Math.max(Math.min(minimum, box.h), hy * (p.y - anchor.y)) / box.h : 1;
  if (lock) {
    const useX = hx && box.w > 0;
    const useY = hy && box.h > 0;
    const uniform = useX && useY ? Math.max(sx, sy) : useX ? sx : sy;
    sx = uniform;
    sy = uniform;
  }
  return { a: sx, b: 0, c: 0, d: sy, e: anchor.x * (1 - sx), f: anchor.y * (1 - sy) };
}

export function rotate(center, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { a: cos, b: sin, c: -sin, d: cos, e: center.x - cos * center.x + sin * center.y,
    f: center.y - sin * center.x - cos * center.y };
}

export function mapPoint(p, m) {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

export function mapPoints(points, m) {
  return points.map(function (p) {
    const out = { ...p, ...mapPoint(p, m) };
    for (const n of ["1", "2"]) {
      if (Number.isFinite(p["cx" + n]) && Number.isFinite(p["cy" + n])) {
        const cp = mapPoint({ x: p["cx" + n], y: p["cy" + n] }, m);
        out["cx" + n] = cp.x;
        out["cy" + n] = cp.y;
      }
    }
    return out;
  });
}
