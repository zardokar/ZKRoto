// DRAW (no DOM): OpenPose 18 like the ControlNet annotator (limbs as ellipses at 60 % colour, joints full colour,
// 4 px at a 512 px short side) and MediaPipe 33 lines + points, on any 2D context.
import { LIMBS } from "./zk_openpose.js";

const FULL_TURN = Math.PI * 2;
const HALF = 2;

function rgb(c, k) {
  return `rgb(${Math.round(c[0] * k)}, ${Math.round(c[1] * k)}, ${Math.round(c[2] * k)})`;
}

function seen(p) {
  return p && p[2] > 0;
}

export function drawOpenPose(g, op, colors, size, cfg) {
  const unit = Math.min(size[0], size[1]) / cfg.refShortSide;
  const stick = cfg.stickWidth * unit;
  const radius = cfg.jointRadius * unit;
  LIMBS.forEach(function ([a, b], i) {
    const p = op[a];
    const q = op[b];
    if (!seen(p) || !seen(q)) {
      return;
    }
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const angle = Math.atan2(q[1] - p[1], q[0] - p[0]);
    g.fillStyle = rgb(colors[i], cfg.limbShade);
    g.beginPath();
    g.ellipse((p[0] + q[0]) / HALF, (p[1] + q[1]) / HALF, len / HALF, stick, angle, 0, FULL_TURN);
    g.fill();
  });
  op.forEach(function (p, j) {
    if (!seen(p)) {
      return;
    }
    g.fillStyle = rgb(colors[j], 1);
    g.beginPath();
    g.arc(p[0], p[1], radius, 0, FULL_TURN);
    g.fill();
  });
}

// OpenPose face 70 like the annotator: white points only, 3 px at a 512 px short side (scaled).
export function drawOpenFace(g, face, color, size, cfg) {
  const radius = cfg.faceRadius * (Math.min(size[0], size[1]) / cfg.refShortSide);
  g.fillStyle = rgb(color, 1);
  for (const p of face) {
    if (!seen(p)) {
      continue;
    }
    g.beginPath();
    g.arc(p[0], p[1], radius, 0, FULL_TURN);
    g.fill();
  }
}

// Plain points (the 478-point face mesh on screen): every shown point as a small dot in one colour.
export function drawPoints(g, points, color, radius) {
  g.fillStyle = color;
  for (const p of points) {
    if (!seen(p)) {
      continue;
    }
    g.beginPath();
    g.arc(p[0], p[1], radius, 0, FULL_TURN);
    g.fill();
  }
}

// colorOf(i, j) gives the colour of the connection i-j (or of point i when j is undefined).
export function drawMediaPipe(g, mp, connections, colorOf, opts) {
  const ok = function (p) {
    return p && p[2] > 0 && p[2] >= opts.threshold;
  };
  g.lineWidth = opts.lineWidth;
  for (const [a, b] of connections) {
    if (!ok(mp[a]) || !ok(mp[b])) {
      continue;
    }
    g.strokeStyle = colorOf(a, b);
    g.beginPath();
    g.moveTo(mp[a][0], mp[a][1]);
    g.lineTo(mp[b][0], mp[b][1]);
    g.stroke();
  }
  mp.forEach(function (p, i) {
    if (!ok(p)) {
      return;
    }
    g.fillStyle = colorOf(i);
    g.beginPath();
    g.arc(p[0], p[1], opts.radius, 0, FULL_TURN);
    g.fill();
  });
}

// sides: one letter per MediaPipe point (constants mpSides): "l" = the person's left, "r" = right, "c" = centre.
export function sideColor(i, colors, sides) {
  const side = sides[i];
  if (side === "l") {
    return colors.left;
  }
  return side === "r" ? colors.right : colors.center;
}

export function connectionColor(a, b, colors, sides) {
  const ca = sideColor(a, colors, sides);
  return b === undefined || ca === sideColor(b, colors, sides) ? ca : colors.center;
}
