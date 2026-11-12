// LOGICAL (pure): POV settings - defaults from config, camera clamps (yaw wraps), presets, orbit, view cycle and
// the panel options. Every function returns a new object; the input is never changed.
const HALF_TURN = 180;
const FULL_TURN = 360;
const NUMERIC = ["yaw", "eyeHeight", "distance", "fov", "roll"];
const PERSONS = [0, 1];

function stepRound(v, step) {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return Number((Math.round(v / step) * step).toFixed(decimals));
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// into -180 .. 180 with 180 kept as 180 (Back), -180 shown as 180
function wrapYaw(v) {
  const w = ((((v + HALF_TURN) % FULL_TURN) + FULL_TURN) % FULL_TURN) - HALF_TURN;
  return w === -HALF_TURN ? HALF_TURN : w;
}

export function povDefaults(cfg) {
  const p = cfg.pov;
  return {
    view: p.view, person: p.person, camera: { ...p.camera }, outMode: p.outMode, custom: p.custom.size.slice(),
    framing: p.framing, margins: { ...p.margins }, layers: { ...p.layers }, threshold: p.threshold, depth: p.depth, xy: p.xy,
    srcCamera: cfg.export.srcCamera, names: { shot: "", character: "" }, tab: cfg.layout.tab,
  };
}

export function setCamera(pov, patch, cfg) {
  const cam = { ...pov.camera };
  for (const key of NUMERIC) {
    const v = Number(patch[key]);
    if (patch[key] === undefined || !Number.isFinite(v)) {
      continue;
    }
    const [lo, hi, step] = cfg.pov.ranges[key];
    cam[key] = key === "yaw" ? stepRound(wrapYaw(v), step) : stepRound(clamp(v, lo, hi), step);
  }
  if (cfg.pov.lookAt.includes(patch.lookAt)) {
    cam.lookAt = patch.lookAt;
  }
  return { ...pov, camera: cam };
}

export function applyPreset(pov, name, cfg) {
  const preset = cfg.pov.presets[name];
  return preset ? setCamera(pov, preset, cfg) : null;
}

export function resetCamera(pov, cfg) {
  return { ...pov, camera: { ...cfg.pov.camera } };
}

export function orbit(pov, dx, dy, cfg) {
  const o = cfg.pov.orbit;
  const c = pov.camera;
  return setCamera(pov, { yaw: c.yaw + dx * o.yawPerPx, eyeHeight: c.eyeHeight - dy * o.heightPerPx }, cfg);
}

export function zoom(pov, deltaY, cfg) {
  return setCamera(pov, { distance: pov.camera.distance + deltaY * cfg.pov.orbit.distancePerWheel }, cfg);
}

export function nextView(view, views) {
  return views[(views.indexOf(view) + 1) % views.length];
}

function pickMargins(old, patch, max) {
  const out = { ...old };
  for (const key of Object.keys(old)) {
    const v = Number(patch[key]);
    if (patch[key] !== undefined && Number.isFinite(v)) {
      out[key] = clamp(v, 0, max);
    }
  }
  return out;
}

function pickBooleans(old, patch) {
  const out = { ...old };
  for (const key of Object.keys(old)) {
    if (typeof patch[key] === "boolean") {
      out[key] = patch[key];
    }
  }
  return out;
}

function pickNames(old, patch) {
  return { shot: String(patch.shot ?? old.shot), character: String(patch.character ?? old.character) };
}

export function setOptions(pov, patch, cfg) {
  const p = cfg.pov;
  const out = { ...pov };
  const pick = function (key, ok) {
    if (patch[key] !== undefined && ok(patch[key])) {
      out[key] = patch[key];
    }
  };
  pick("view", function (v) {
    return p.views.includes(v);
  });
  pick("person", function (v) {
    return PERSONS.includes(v);
  });
  pick("outMode", function (v) {
    return p.outModes.includes(v);
  });
  pick("framing", function (v) {
    return p.framings.includes(v);
  });
  pick("xy", function (v) {
    return p.xyFrom.includes(v);
  });
  pick("tab", function (v) {
    return v in cfg.layout.tabs;
  });
  pick("srcCamera", function (v) {
    return typeof v === "boolean";
  });
  pick("custom", function (v) {
    return Array.isArray(v) && v.length === 2 && v.every(Number.isFinite);
  });
  if (patch.depth !== undefined && Number.isFinite(Number(patch.depth))) {
    const [lo, hi, step] = p.ranges.depth;
    out.depth = stepRound(clamp(Number(patch.depth), lo, hi), step);
  }
  if (patch.threshold !== undefined && Number.isFinite(Number(patch.threshold))) {
    out.threshold = clamp(Number(patch.threshold), 0, 1);
  }
  out.margins = pickMargins(pov.margins, patch.margins || {}, p.marginMax);
  out.layers = pickBooleans(pov.layers, patch.layers || {});
  out.names = pickNames(pov.names, patch.names || {});
  return out;
}
