// LOGICAL (pure): the head crop of one person for the Face Landmarker (in full-body frames the face is too small
// for its detector) and the way back from crop to frame coordinates. Points: normalized image [x, y, ...].
const NOSE = 0;
const EARS = [7, 8];
const SHOULDERS = [11, 12];
const HIPS = [23, 24];

function mid(points, pair, W, H) {
  const [a, b] = pair;
  return [((points[a][0] + points[b][0]) / 2) * W, ((points[a][1] + points[b][1]) / 2) * H];
}

// Square of side torso length x scale, centred between the nose and the middle of the ears (works for 3/4 views).
export function headCrop(points, W, H, scale) {
  const s = mid(points, SHOULDERS, W, H);
  const h = mid(points, HIPS, W, H);
  const size = Math.hypot(s[0] - h[0], s[1] - h[1]) * scale;
  const ears = mid(points, EARS, W, H);
  const cx = (points[NOSE][0] * W + ears[0]) / 2;
  const cy = (points[NOSE][1] * H + ears[1]) / 2;
  return { x: cx - size / 2, y: cy - size / 2, size };
}

// Landmarks normalized to the crop -> normalized to the frame; z keeps MediaPipe's unit (frame width).
export function cropToFrame(points, crop, W, H) {
  return points.map(function (p) {
    return [(crop.x + p[0] * crop.size) / W, (crop.y + p[1] * crop.size) / H, (p[2] * crop.size) / W];
  });
}
