// LOGICAL (pure): MediaPipe Face Landmarker 478 points -> OpenPose face 70 (68 points in dlib order + 2 pupils),
// the face format the ControlNet openpose annotator draws. 0 = jaw on the person's right (image left, facing).
export const FACE70 = [
  162, 234, 93, 58, 172, 136, 149, 148, 152, 377, 378, 365, 397, 288, 323, 454, 389,
  71, 63, 105, 66, 107, 336, 296, 334, 293, 301,
  168, 197, 5, 4, 75, 97, 2, 326, 305,
  33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380,
  61, 39, 37, 0, 267, 269, 291, 405, 314, 17, 84, 181,
  78, 82, 13, 312, 308, 317, 14, 87,
  468, 473,
];

// points: 478 x [x, y, c] in pixels of one camera (c = 0: hidden); returns 70 x [x, y, c].
export function toOpenFace(points) {
  return FACE70.map(function (i) {
    const p = points[i];
    return p && p[2] > 0 ? [p[0], p[1], p[2]] : [0, 0, 0];
  });
}
