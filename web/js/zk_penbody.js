// LOGICAL (pure): the stroke body of an open path as a polygon - the centre line offset by +-w(u)/2 with a width
// profile that tapers at both ends (hair strand: the root fades in, the tip is a long sharp taper; Koh 2026-11-24
// "ปลายไม่ใช่แท่ง"). taper = [root share, tip share] of the length; 0 = no taper on that end.
const ROOT_POWER = 0.7;
const TIP_POWER = 1.6;

export function widthAt(u, width, taper) {
  const root = taper[0] > 0 ? Math.pow(Math.min(1, u / taper[0]), ROOT_POWER) : 1;
  const tip = taper[1] > 0 ? Math.pow(Math.min(1, (1 - u) / taper[1]), TIP_POWER) : 1;
  return width * Math.max(0, Math.min(root, tip));
}

function lengths(points) {
  const s = [0];
  for (let i = 1; i < points.length; i += 1) {
    s.push(s[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  return s;
}

function normalAt(points, i) {
  const a = points[Math.max(0, i - 1)];
  const b = points[Math.min(points.length - 1, i + 1)];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
}

// Left side forward, right side back: one closed polygon ready to fill.
export function bodyPolygon(points, stroke) {
  if (points.length < 2) {
    return [];
  }
  const s = lengths(points);
  const total = s[s.length - 1] || 1;
  const left = [];
  const right = [];
  points.forEach(function (p, i) {
    const half = widthAt(s[i] / total, stroke.width, stroke.taper) / 2;
    const n = normalAt(points, i);
    left.push([p[0] + n[0] * half, p[1] + n[1] * half]);
    right.push([p[0] - n[0] * half, p[1] - n[1] * half]);
  });
  return left.concat(right.reverse());
}
