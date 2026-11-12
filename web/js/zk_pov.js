// LOGICAL (pure): one person's 33 MediaPipe points -> both layers (MediaPipe 33 + OpenPose 18) in pixels of a camera:
// the source camera (image points x video size) or the POV camera (world points, camera, framing). No DOM.
import { toOpenPose } from "./zk_openpose.js";
import { toYUp, floorY, targetPoint, eyePoint, viewBasis, project } from "./zk_camera.js";
import { frame } from "./zk_framing.js";
import { toOpenFace } from "./zk_openface.js";
import { faceWorld, faceForward, headCentre, metresPerPixel } from "./zk_facefit.js";
import { sheetWorld } from "./zk_sheet.js";

const VIS = 3;
const HIDDEN = [0, 0, 0];
const AWAY_COS = -0.5;

function visibility(person) {
  return person.image.map(function (p) {
    return p[VIS] ?? 0;
  });
}

function srcFace(person, width, height) {
  if (!person.face) {
    return null;
  }
  const mp = person.face.image.map(function (p) {
    return [p[0] * width, p[1] * height, 1];
  });
  return { mp, op: toOpenFace(mp) };
}

export function srcPoints(person, width, height, threshold) {
  const mp = person.image.map(function (p) {
    return [p[0] * width, p[1] * height, p[VIS] ?? 0];
  });
  return { mp, op: toOpenPose(mp, threshold), face: srcFace(person, width, height) };
}

// Face mesh in the body's world, same camera. A point shows only when it faces the eye (seen from the head centre),
// so side views keep the near half; a face turned over 120 degrees away is hidden whole. face.size = its frame size.
function povFace(person, ctx) {
  if (!person.face) {
    return null;
  }
  const { eye, basis, cam, size, near } = ctx;
  const [fw, fh] = person.face.size;
  const raw = faceWorld(person, fw, fh);
  const fwd = faceForward(person, fw, fh);
  const [c, f] = toYUp([headCentre(raw, fwd), fwd]);
  const world = toYUp(raw);
  const look = [eye[0] - c[0], eye[1] - c[1], eye[2] - c[2]];
  const away = (f[0] * look[0] + f[1] * look[1] + f[2] * look[2]) / Math.hypot(...look) < AWAY_COS;
  const projected = project(world, eye, basis, cam.fov, size, near);
  return projected.map(function (p, i) {
    const q = world[i];
    const out = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
    const toEye = [eye[0] - q[0], eye[1] - q[1], eye[2] - q[2]];
    const faces = out[0] * toEye[0] + out[1] * toEye[1] + out[2] * toEye[2] > 0;
    return p && faces && !away ? [p[0], p[1], 1] : HIDDEN.slice();
  });
}

const HIPS = [23, 24];

// pov.xy "image": x / y from the image points (metres via the torso, hips = 0), only z from MediaPipe's 3D;
// "world": MediaPipe's 3D as it is. pov.depth scales z (1 = as guessed). src = { width, height } of the frame.
function rebuild(person, pov, src) {
  const depth = pov.depth ?? 1;
  if (pov.xy === "sheet" && src && src.side) {
    const sd = src.side;
    return { ...person, world: sheetWorld(person, src.width, src.height, sd.person, sd.width, sd.height, pov.blend ?? 0, pov.fit) };
  }
  if (pov.xy !== "image" || !src) {
    return { ...person, world: person.world.map(function (p) {
      return [p[0], p[1], p[2] * depth];
    }) };
  }
  const k = metresPerPixel(person, src.width, src.height);
  const [a, b] = HIPS;
  const hx = (person.image[a][0] + person.image[b][0]) / 2;
  const hy = (person.image[a][1] + person.image[b][1]) / 2;
  const world = person.image.map(function (p, i) {
    return [(p[0] - hx) * src.width * k, (p[1] - hy) * src.height * k, person.world[i][2] * depth];
  });
  return { ...person, world };
}

export function povPoints(raw, pov, size, cfg, src, fixed) {
  const person = rebuild(raw, pov, src);
  const vis = visibility(person);
  const world = toYUp(person.world);
  const cam = pov.camera;
  const floor = floorY(world, vis, pov.threshold);
  const target = targetPoint(world, cam.lookAt);
  const eye = eyePoint(cam, target, floor);
  const basis = viewBasis(eye, target, cam.yaw, cam.roll);
  const projected = project(world, eye, basis, cam.fov, size, cfg.pov.nearClip);
  const mp = projected.map(function (p, i) {
    return p ? [p[0], p[1], vis[i]] : HIDDEN.slice();
  });
  const faceMp = povFace(person, { eye, basis, cam, size, near: cfg.pov.nearClip });
  const layers = { op: toOpenPose(mp, pov.threshold), mp };
  if (faceMp) {
    layers.faceMp = faceMp;
  }
  const framed = frame(layers, pov.framing, size, pov.margins, fixed);
  const face = faceMp ? { mp: framed.faceMp, op: toOpenFace(framed.faceMp) } : null;
  return { mp: framed.mp, op: framed.op, face, eye, target, floor };
}
