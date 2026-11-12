// LOGICAL (pure): point edits. Document { version, clip, frames: { frame: { person: { index: [x, y] } } } }, image
// coordinates 0..1 of the moved MediaPipe points only. Applied on the MediaPipe pose (kept as pose.raw): image x / y
// replaced, world x / y moved by the same pixels in metres (torso scale of the unedited person), z and visibility kept.
import { metresPerPixel } from "./zk_facefit.js";

export const EDITS_VERSION = 1;
const DECIMALS = 1e5;

function round(v) {
  return Math.round(Math.min(1, Math.max(0, v)) * DECIMALS) / DECIMALS;
}

export function emptyEdits(clip) {
  return { version: EDITS_VERSION, clip, frames: {} };
}

// Copy of the levels on the way to one person of one frame (the rest is shared, never changed).
function withPerson(doc, frame, person, fn) {
  const frames = { ...doc.frames };
  const people = { ...(frames[frame] || {}) };
  const points = fn({ ...(people[person] || {}) });
  if (Object.keys(points).length) {
    people[person] = points;
  } else {
    delete people[person];
  }
  if (Object.keys(people).length) {
    frames[frame] = people;
  } else {
    delete frames[frame];
  }
  return { ...doc, frames };
}

export function setPoint(doc, frame, person, index, xy) {
  return withPerson(doc, frame, person, function (points) {
    points[index] = [round(xy[0]), round(xy[1])];
    return points;
  });
}

export function clearPoint(doc, frame, person, index) {
  return withPerson(doc, frame, person, function (points) {
    delete points[index];
    return points;
  });
}

export function clearFrame(doc, frame) {
  const frames = { ...doc.frames };
  delete frames[frame];
  return { ...doc, frames };
}

export function frameEdits(doc, frame, person) {
  const f = doc && doc.frames[frame];
  return (f && f[person]) || null;
}

export function editedFrames(doc) {
  return Object.keys(doc.frames).map(Number).sort(function (a, b) {
    return a - b;
  });
}

function applyPerson(person, edits, W, H) {
  const k = metresPerPixel(person, W, H);
  const image = person.image.slice();
  const world = person.world.slice();
  const edited = Object.keys(edits).map(Number).sort(function (a, b) {
    return a - b;
  });
  for (const i of edited) {
    const [x, y] = edits[i];
    const p = person.image[i];
    const q = person.world[i];
    image[i] = [x, y, p[2], p[3]];
    world[i] = [q[0] + (x - p[0]) * W * k, q[1] + (y - p[1]) * H * k, q[2]];
  }
  return { ...person, image, world, edited };
}

// pose.raw (when present) is the MediaPipe pose; the result always keeps it as raw, so edits are never stacked.
export function applyEdits(pose, doc) {
  const raw = pose.raw || pose;
  const people = raw.people.map(function (p, i) {
    const e = frameEdits(doc, raw.frame, i);
    return e ? applyPerson(p, e, raw.width, raw.height) : p;
  });
  return { ...raw, people, raw };
}

// Index of the point nearest to (x, y) pixels within radius, else -1. points: image [x, y] 0..1.
export function nearest(points, W, H, x, y, radius) {
  let best = -1;
  let dist = radius;
  points.forEach(function (p, i) {
    const d = Math.hypot(p[0] * W - x, p[1] * H - y);
    if (d <= dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}

// A read file -> { doc, problem }: null file = empty edits; another clip or version = empty edits + the reason.
export function parseEdits(data, clip) {
  if (!data) {
    return { doc: emptyEdits(clip), problem: null };
  }
  if (data.version !== EDITS_VERSION || typeof data.frames !== "object") {
    return { doc: emptyEdits(clip), problem: "badEdits" };
  }
  if (data.clip !== clip) {
    return { doc: emptyEdits(clip), problem: "otherClip" };
  }
  return { doc: data, problem: null };
}
