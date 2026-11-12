// LOGICAL (pure): POV camera on MediaPipe world points - Y up, floor, target, eye, look-at + roll, pinhole projection.
// World (MediaPipe): metres, hips = 0, x image right, y down, z smaller = nearer the source camera. Design doc 4.
const DEG = Math.PI / 180;
const WORLD_UP = [0, 1, 0];
const TINY = 1e-9;
const TARGETS = { hips: [23, 24], chest: [11, 12], head: [7, 8] };

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function scale(a, s) {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function unit(a) {
  return scale(a, 1 / Math.hypot(a[0], a[1], a[2]));
}

export function toYUp(world) {
  return world.map(function (p) {
    return [p[0], -p[1], -p[2]];
  });
}

export function floorY(points, vis, threshold) {
  const ys = points.filter(function (_p, i) {
    return vis[i] >= threshold;
  }).map(function (p) {
    return p[1];
  });
  const all = ys.length > 0 ? ys : points.map(function (p) {
    return p[1];
  });
  return Math.min(...all);
}

export function targetPoint(points, lookAt) {
  const [a, b] = TARGETS[lookAt] || TARGETS.chest;
  return scale(add(points[a], points[b]), 0.5);
}

export function eyePoint(cam, target, floor) {
  const yaw = cam.yaw * DEG;
  return [target[0] + cam.distance * Math.sin(yaw), floor + cam.eyeHeight, target[2] + cam.distance * Math.cos(yaw)];
}

// Look from the eye at the target, world up; an eye straight above the target uses the yaw direction for "right".
export function viewBasis(eye, target, yawDeg, rollDeg) {
  const fwd = unit(sub(target, eye));
  const side = cross(fwd, WORLD_UP);
  const yaw = yawDeg * DEG;
  const right0 = Math.hypot(...side) < TINY ? [Math.cos(yaw), 0, -Math.sin(yaw)] : unit(side);
  const up0 = cross(right0, fwd);
  const r = rollDeg * DEG;
  const right = add(scale(right0, Math.cos(r)), scale(up0, Math.sin(r)));
  const up = sub(scale(up0, Math.cos(r)), scale(right0, Math.sin(r)));
  return { right, up, fwd };
}

// Pinhole with a vertical FOV: f = (H / 2) / tan(fov / 2). Behind the eye or nearer than `near` -> null.
export function project(points, eye, basis, fovDeg, size, near) {
  const [W, H] = size;
  const f = H / 2 / Math.tan((fovDeg * DEG) / 2);
  return points.map(function (p) {
    const d = sub(p, eye);
    const z = dot(d, basis.fwd);
    if (z < near) {
      return null;
    }
    return [W / 2 + (f * dot(d, basis.right)) / z, H / 2 - (f * dot(d, basis.up)) / z, z];
  });
}
