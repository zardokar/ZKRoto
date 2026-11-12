// LOGICAL (pure): put the 478-point face mesh into the body's world (MediaPipe world: metres, hips = 0, x right,
// y down, z away from the source camera). The mesh keeps its own shape (its axes are the camera's, like the world):
// scale = metres per pixel of the torso, placed so it sits on the image exactly where it was found, depth at the nose.
const NOSE = 0;
const MESH_NOSE = 1;
const SCALE_PAIRS = [[11, 12], [11, 23], [12, 24]];
const CHEEKS = [234, 454];
const BROW_CHIN = [10, 152];
const HEAD_DEPTH = 0.8;

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function unit(a) {
  const n = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / n, a[1] / n, a[2] / n];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function meshPixels(person, W, H) {
  return person.face.image.map(function (p) {
    return [p[0] * W, p[1] * H, p[2] * W];
  });
}

// Metres per image pixel from the torso (shoulders, both sides): world x / y lengths over image lengths.
export function metresPerPixel(person, W, H) {
  let m = 0;
  let px = 0;
  for (const [a, b] of SCALE_PAIRS) {
    const wa = person.world[a];
    const wb = person.world[b];
    const ia = person.image[a];
    const ib = person.image[b];
    m += Math.hypot(wa[0] - wb[0], wa[1] - wb[1]);
    px += Math.hypot((ia[0] - ib[0]) * W, (ia[1] - ib[1]) * H);
  }
  return m / px;
}

export function faceWorld(person, W, H) {
  const mesh = meshPixels(person, W, H);
  const k = metresPerPixel(person, W, H);
  const nose = person.world[NOSE];
  const noseImage = [person.image[NOSE][0] * W, person.image[NOSE][1] * H];
  const depth0 = mesh[MESH_NOSE][2];
  return mesh.map(function (p) {
    return [nose[0] + (p[0] - noseImage[0]) * k, nose[1] + (p[1] - noseImage[1]) * k, nose[2] + (p[2] - depth0) * k];
  });
}

// Unit vector the face looks along (MediaPipe world), from the mesh: across the cheeks x up the face.
export function faceForward(person, W, H) {
  const mesh = meshPixels(person, W, H);
  return unit(cross(sub(mesh[CHEEKS[1]], mesh[CHEEKS[0]]), sub(mesh[BROW_CHIN[0]], mesh[BROW_CHIN[1]])));
}

// A point inside the head, behind the face (centre of the mesh moved back by 0.8 x the cheek width).
export function headCentre(world, forward) {
  const n = world.length;
  const c = [0, 1, 2].map(function (i) {
    return world.reduce(function (s, p) {
      return s + p[i];
    }, 0) / n;
  });
  const width = Math.hypot(...sub(world[CHEEKS[0]], world[CHEEKS[1]]));
  return [c[0] - forward[0] * width * HEAD_DEPTH, c[1] - forward[1] * width * HEAD_DEPTH, c[2] - forward[2] * width * HEAD_DEPTH];
}
