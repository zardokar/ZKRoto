// LOGICAL (pure): one 3D body from a character sheet - x / y from the front picture, depth from the side picture
// (user choice 2026-11-10 07:01, option 2: side posture from a second picture instead of MediaPipe's depth guess).
// Output in MediaPipe's world convention (x right, y down, z toward the front camera negative), hips at 0, metres.
import { metresPerPixel } from "./zk_facefit.js";

const NOSE = 0;
const EARS = [7, 8];
const SHOULDERS = [11, 12];
const HIPS = [23, 24];
const ANKLES = [27, 28];

function mid(points, [a, b], axis) {
  return (points[a][axis] + points[b][axis]) / 2;
}

// Shoulders to ankles, in pixels: the same body in both pictures, so it sets the side picture's scale.
function span(person, height) {
  return Math.abs(mid(person.image, SHOULDERS, 1) - mid(person.image, ANKLES, 1)) * height;
}

const BODY = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

// Side picture scale that best puts each body joint at its front-picture height (least squares, pixels).
export function heightScale(front, fh, side, sh) {
  const f = BODY.map(function (i) {
    return front.image[i][1] * fh;
  });
  const s = BODY.map(function (i) {
    return side.image[i][1] * sh;
  });
  const mean = function (list) {
    return list.reduce(function (a, b) {
      return a + b;
    }, 0) / list.length;
  };
  const mf = mean(f);
  const ms = mean(s);
  let num = 0;
  let den = 0;
  s.forEach(function (v, k) {
    num += (v - ms) * (f[k] - mf);
    den += (v - ms) * (v - ms);
  });
  return num / den;
}

// +1 when the person faces right in the side picture (nose right of the ears), -1 when facing left.
export function facing(side) {
  return side.image[NOSE][0] > mid(side.image, EARS, 0) ? 1 : -1;
}

export function sheetWorld(front, fw, fh, side, sw, sh, blend = 0, fit = "span") {
  const k = metresPerPixel(front, fw, fh);
  const ratio = fit === "lsq" ? heightScale(front, fh, side, sh) : span(front, fh) / span(side, sh);
  const ks = k * ratio;
  const fx = mid(front.image, HIPS, 0);
  const fy = mid(front.image, HIPS, 1);
  const sx = mid(side.image, HIPS, 0);
  const dir = facing(side);
  const sy = mid(side.image, HIPS, 1);
  return front.image.map(function (p, i) {
    const forward = (side.image[i][0] - sx) * sw * ks * dir;
    const y = (p[1] - fy) * fh * k * (1 - blend) + (side.image[i][1] - sy) * sh * ks * blend;
    return [(p[0] - fx) * fw * k, y, -forward];
  });
}
