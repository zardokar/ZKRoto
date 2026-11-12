// LOGICAL (pure): MediaPipe 33 points -> OpenPose 18 (COCO order of the ControlNet openpose annotator), limb list.
// Points are [x, y, c]; c under the threshold (or 0 = already hidden) gives [0, 0, 0]. Design doc 5.1.
const NECK = -1;
const SHOULDER_L = 11;
const SHOULDER_R = 12;
const MP_OF_OP = [0, NECK, 12, 14, 16, 11, 13, 15, 24, 26, 28, 23, 25, 27, 5, 2, 8, 7];
const HIDDEN = [0, 0, 0];

export const LIMBS = [[1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [1, 8], [8, 9], [9, 10], [1, 11],
  [11, 12], [12, 13], [1, 0], [0, 14], [14, 16], [0, 15], [15, 17]];

function shown(p, threshold) {
  return p[2] > 0 && p[2] >= threshold;
}

function neck(points, threshold) {
  const l = points[SHOULDER_L];
  const r = points[SHOULDER_R];
  if (!shown(l, threshold) || !shown(r, threshold)) {
    return HIDDEN.slice();
  }
  return [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2, Math.min(l[2], r[2])];
}

export function toOpenPose(points, threshold) {
  return MP_OF_OP.map(function (m) {
    if (m === NECK) {
      return neck(points, threshold);
    }
    const p = points[m];
    return shown(p, threshold) ? [p[0], p[1], p[2]] : HIDDEN.slice();
  });
}

export function visibleCount(points) {
  return points.filter(function (p) {
    return p[2] > 0;
  }).length;
}
