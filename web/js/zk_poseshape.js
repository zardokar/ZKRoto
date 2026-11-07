// LOGICAL (pure): turn a pose engine result into plain arrays (image [x, y, z, vis], world [x, y, z]).
const DECIMALS = 1e4;

export function round4(v) {
  return Math.round(v * DECIMALS) / DECIMALS;
}

function imagePoint(p) {
  return [round4(p.x), round4(p.y), round4(p.z), round4(p.visibility ?? 0)];
}

function worldPoint(p) {
  return [round4(p.x), round4(p.y), round4(p.z)];
}

export function shapePose(result, meta) {
  const world = result.worldLandmarks;
  const people = result.landmarks.map(function (pts, i) {
    return { image: pts.map(imagePoint), world: (world[i] || []).map(worldPoint) };
  });
  return { frame: meta.frame, width: meta.width, height: meta.height, ms: Math.round(meta.ms), people };
}
