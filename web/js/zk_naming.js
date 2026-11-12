// LOGICAL (pure): names of the shot folder and its files. Prefix <shot>_<character> (empty shot = clip name,
// empty character left out); camera name pov_y035_h155_d120_f60[_r10|_rm10][_L|_c<W>x<H>]; src = fixed name.
const NOT_NAME = /[^A-Za-z0-9-]+/g;
const EDGE_DASH = /^-+|-+$/g;
const DASH_RUN = /-{2,}/g;
const EXTENSION = /\.[^.]+$/;
const SEP = "_";
const SRC = "src";
const FULL_TURN = 360;
const CM = 100;
const PAD3 = 3;
const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9]|capture)$/i;

export function cleanName(s) {
  return String(s || "").replace(NOT_NAME, "-").replace(DASH_RUN, "-").replace(EDGE_DASH, "");
}

export function shotParts(names) {
  const shot = cleanName(names.shot) || cleanName(String(names.clip || "").replace(EXTENSION, ""));
  return { shot, character: cleanName(names.character) };
}

// Why a shot name cannot be used (a constants text key), or null: empty (e.g. a clip name without A-Z letters
// or digits) or a Windows device name / the Capture folder.
export function shotProblem(parts) {
  if (!parts.shot) {
    return "noShot";
  }
  return RESERVED.test(parts.shot) ? "reservedShot" : null;
}

export function shotPrefix(names) {
  const p = shotParts(names);
  return p.character ? p.shot + SEP + p.character : p.shot;
}

function three(n) {
  return String(n).padStart(PAD3, "0");
}

function sizeTag(out) {
  if (out.mode === "landscape") {
    return "_L";
  }
  if (out.mode === "custom") {
    return `_c${out.width}x${out.height}`;
  }
  return "";
}

export function cameraName(cam, out) {
  const yaw = ((Math.round(cam.yaw) % FULL_TURN) + FULL_TURN) % FULL_TURN;
  const roll = Math.round(cam.roll);
  const h = Math.round(cam.eyeHeight * CM);
  const d = Math.round(cam.distance * CM);
  const fov = Math.round(cam.fov);
  let name = `pov_y${three(yaw)}_h${three(h)}_d${three(d)}_f${fov}`;
  if (roll !== 0) {
    name += roll < 0 ? `_rm${-roll}` : `_r${roll}`;
  }
  return name + sizeTag(out);
}

export function fileNames(prefix, frame, digits, camera) {
  const f = `${prefix}_f${String(frame).padStart(digits, "0")}`;
  return {
    opPng: `${f}_${camera}.png`,
    opJson: `${f}_${camera}.json`,
    mpJson: `${f}_${camera}.json`,
    sheet: `${prefix}_sheet_${camera}.png`,
    frameJson: `${f}.json`,
    shotJson: `${prefix}_shot.json`,
  };
}

export function subFolders(camera) {
  const side = camera === SRC ? SRC : "pov";
  return {
    op: `openpose/${side}`, mp: `mediapipe/${side}`, faceOp: `openpose/face/${side}`, faceMp: `mediapipe/face/${side}`,
    full: `openpose/full/${side}`, sheet: "mediapipe", zk: "zkroto",
  };
}

export function captureSubfolder(app, folder, base) {
  return `${app}/${folder}/${base}`;
}
