// LOGICAL (pure): framing of projected points. "fit" = uniform scale + move so the box of the visible OpenPose
// joints sits on the margins on the limiting side and is centred in the other; "true" = the plain projection.
const IDENTITY = { s: 1, tx: 0, ty: 0 };
const MIN_VISIBLE = 2;
const FIT = "fit";

function bounds(points) {
  const vis = points.filter(function (p) {
    return p[2] > 0;
  });
  if (vis.length < MIN_VISIBLE) {
    return null;
  }
  const xs = vis.map(function (p) {
    return p[0];
  });
  const ys = vis.map(function (p) {
    return p[1];
  });
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

export function fitTransform(points, size, margins) {
  const b = bounds(points);
  const [W, H] = size;
  if (!b || (b.x1 - b.x0 <= 0 && b.y1 - b.y0 <= 0)) {
    return { ...IDENTITY };
  }
  const left = W * margins.sides;
  const top = H * margins.top;
  const availW = W - 2 * left;
  const availH = H - top - H * margins.bottom;
  // a skeleton seen exactly edge-on has no width (or height): only the other side limits
  const s = Math.min(availW / Math.max(b.x1 - b.x0, 0), availH / Math.max(b.y1 - b.y0, 0));
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  return { s, tx: left + availW / 2 - s * cx, ty: top + availH / 2 - s * cy };
}

export function applyTransform(points, tr) {
  return points.map(function (p) {
    return p[2] > 0 ? [p[0] * tr.s + tr.tx, p[1] * tr.s + tr.ty, p[2]] : [0, 0, 0];
  });
}

// One transform for a frame range: the box of the visible joints of every frame (list of OpenPose layers).
export function rangeFit(opList, size, margins) {
  return fitTransform([].concat(...opList), size, margins);
}

// Every layer gets the transform computed from the OpenPose body layer, so shared joints stay on one pixel.
// fixed (optional): a transform given from outside (a frame range: one framing for every frame).
export function frame(layers, mode, size, margins, fixed) {
  if (mode !== FIT) {
    return layers;
  }
  const tr = fixed || fitTransform(layers.op, size, margins);
  const out = {};
  for (const [key, points] of Object.entries(layers)) {
    out[key] = Array.isArray(points) ? applyTransform(points, tr) : points;
  }
  return out;
}
