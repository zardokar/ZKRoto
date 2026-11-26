// LOGICAL (pure): geometry of the colour wheel, ported from Koh's canvas module (cv_wheel.js, docs/cv_picker.js.md):
// hue ring outside, S/V triangle inside that turns with the hue (A = pure colour, B = white, C = black).
// Angle 0 at the top, clockwise = CSS conic-gradient(from 0deg). Units = the 200 x 200 viewBox.
export const WHEEL_SIZE = 200;
export const RING_OUT = 100;
export const RING_IN = 76;
const KNOB_GRAB = 16;
const MID = WHEEL_SIZE / 2;

export function wheelPoint(angle, radius) {
  const rad = (angle * Math.PI) / 180;
  return { x: MID + radius * Math.sin(rad), y: MID - radius * Math.cos(rad) };
}

export function wheelAngle(p) {
  const deg = (Math.atan2(p.x - MID, MID - p.y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function onRing(p) {
  const r = Math.hypot(p.x - MID, p.y - MID);
  return r <= RING_OUT + 8 && r >= RING_IN - 4;
}

function near(p, knob) {
  return Math.hypot(p.x - knob.x, p.y - knob.y) <= KNOB_GRAB;
}

export function triVerts(hue) {
  return { a: wheelPoint(hue, RING_IN), b: wheelPoint(hue + 120, RING_IN), c: wheelPoint(hue + 240, RING_IN) };
}

function bary(p, v) {
  const d = (v.b.y - v.c.y) * (v.a.x - v.c.x) + (v.c.x - v.b.x) * (v.a.y - v.c.y);
  if (d === 0) {
    return { a: 1, b: 0, c: 0 };
  }
  const wa = ((v.b.y - v.c.y) * (p.x - v.c.x) + (v.c.x - v.b.x) * (p.y - v.c.y)) / d;
  const wb = ((v.c.y - v.a.y) * (p.x - v.c.x) + (v.a.x - v.c.x) * (p.y - v.c.y)) / d;
  return { a: wa, b: wb, c: 1 - wa - wb };
}

// A point dragged outside the triangle is pulled back to its edge, not dropped (a fast drag never sticks).
function baryClamp(w) {
  const a = Math.max(0, w.a);
  const b = Math.max(0, w.b);
  const c = Math.max(0, w.c);
  const sum = a + b + c;
  return sum === 0 ? { a: 1, b: 0, c: 0 } : { a: a / sum, b: b / sum, c: c / sum };
}

export function triToSv(p, hue) {
  const w = baryClamp(bary(p, triVerts(hue)));
  const v = w.a + w.b;
  return { s: v === 0 ? 0 : w.a / v, v };
}

export function svToTri(s, v, hue) {
  const t = triVerts(hue);
  const wa = s * v;
  const wb = (1 - s) * v;
  const wc = 1 - v;
  return { x: wa * t.a.x + wb * t.b.x + wc * t.c.x, y: wa * t.a.y + wb * t.b.y + wc * t.c.y };
}

// What a press grabs: the nearer knob first, then the place (a miss by a few pixels still hits).
export function wheelTarget(p, hue, s, v) {
  if (near(p, wheelPoint(hue, (RING_OUT + RING_IN) / 2))) {
    return "ring";
  }
  if (near(p, svToTri(s, v, hue))) {
    return "tri";
  }
  return onRing(p) ? "ring" : "tri";
}

export function triPoints(hue) {
  const v = triVerts(hue);
  return [v.a, v.b, v.c].map(function (pt) {
    return Math.round(pt.x * 100) / 100 + "," + Math.round(pt.y * 100) / 100;
  }).join(" ");
}

// The dark gradient runs from the black corner to the middle of the opposite side.
export function triShade(hue) {
  const v = triVerts(hue);
  return { from: v.c, to: { x: (v.a.x + v.b.x) / 2, y: (v.a.y + v.b.y) / 2 } };
}
