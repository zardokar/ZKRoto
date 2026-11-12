// LOGICAL (pure): the four JSON kinds of the shot folder (design doc 6.2). Pixels 2 decimals, other numbers 4.
const PX = 1e2;
const DEC = 1e4;

function px(v) {
  return Math.round(v * PX) / PX;
}

function dec(v) {
  return Math.round(v * DEC) / DEC + 0;
}

function pixelPoint(p) {
  return [px(p[0]), px(p[1]), dec(p[2])];
}

export function openposeJson(op, width, height) {
  return { canvas_width: width, canvas_height: height, people: [{ pose_keypoints_2d: op.map(pixelPoint).flat() }] };
}

export function openposeFaceJson(face, width, height) {
  return { canvas_width: width, canvas_height: height, people: [{ face_keypoints_2d: face.map(pixelPoint).flat() }] };
}

export function mediapipeJson(m) {
  return {
    frame: m.frame,
    camera: m.camera,
    width: m.width,
    height: m.height,
    points: m.points.map(pixelPoint),
    world: m.world.map(function (p) {
      return [dec(p[0]), dec(p[1]), dec(p[2])];
    }),
  };
}

// Our record of one frame; cameras already written for this frame (prev) are kept, new ones added or replaced.
export function frameJson(prev, base, cameras) {
  const old = (prev && prev.cameras) || {};
  return {
    version: base.version,
    shot: base.shot,
    character: base.character,
    clip: base.clip,
    frame: base.frame,
    fps: base.fps,
    time: dec(base.time),
    person: base.person,
    swapped: !!base.swapped,
    edited: base.edited || [],
    cameras: { ...old, ...cameras },
  };
}

export function shotJson(prev, base, frame, cameras) {
  const frames = ((prev && prev.frames) || []).map(function (f) {
    return { frame: f.frame, cameras: f.cameras.slice() };
  });
  let row = frames.find(function (f) {
    return f.frame === frame;
  });
  if (!row) {
    row = { frame, cameras: [] };
    frames.push(row);
  }
  for (const c of cameras) {
    if (!row.cameras.includes(c)) {
      row.cameras.push(c);
    }
  }
  frames.sort(function (a, b) {
    return a.frame - b.frame;
  });
  return { version: base.version, shot: base.shot, character: base.character, clip: base.clip, fps: base.fps, frames };
}

export function framesFor(shot, camera) {
  if (!shot || !shot.frames) {
    return [];
  }
  return shot.frames.filter(function (f) {
    return f.cameras.includes(camera);
  }).map(function (f) {
    return f.frame;
  }).sort(function (a, b) {
    return a - b;
  });
}
