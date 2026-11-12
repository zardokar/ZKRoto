// SERVICE (no UI): Export (Ctrl+E). Pose first if the frame has none -> both layers of the chosen person for each
// camera (src if ticked, POV in the POV / Split view) -> PNG + JSON, plus the full PNG (body + face, openpose/full/)
// -> POST /zkroto/export -> sheets. Design doc 6, 1.13.
import * as N from "./zk_naming.js";
import * as J from "./zk_posejson.js";
import { toBase64 } from "./zk_render.js";
import { faceWorld } from "./zk_facefit.js";

const SOURCE_VIEW = "source";
const SRC = "src";

export function createExporter(ctx, deps) {
  const { cfg, k, state, t } = ctx;
  const { povApi, render } = deps;

  async function call(url, body) {
    const opts = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {};
    const r = await deps.fetch(url, opts);
    const data = await r.json().catch(function () {
      return {};
    });
    if (!r.ok) {
      throw new Error(t("exportFailed", { status: r.status, message: data.error || "" }));
    }
    return data;
  }

  // Everything Export uses, taken once at the start: a seek or a Swap during the network calls changes nothing.
  // opts.fixed / opts.range: one framing transform for a frame range (zk_range.js), written into the POV camera.
  function snapshot(person, opts) {
    return {
      pose: state.lastPose, person, frame: state.frame, pov: state.pov, points: povApi.points(opts.fixed), clip: state.name,
      fps: `${state.fpsNum}/${state.fpsDen}`, time: state.frame / ctx.fps(), fixed: opts.fixed, range: opts.range,
    };
  }

  function cameras(snap, wantSrc, wantPov) {
    const out = [];
    const { pose, pov, points } = snap;
    const who = { person: pov.person, swapped: !!pose.swapped };
    if (wantSrc) {
      out.push({ name: SRC, size: [pose.width, pose.height], layers: points.src, info: { size: [pose.width, pose.height], ...who } });
    }
    if (wantPov) {
      const size = [points.size.width, points.size.height];
      const m = pov.margins;
      const info = { ...pov.camera, size, framing: pov.framing, margin: [m.top, m.bottom, m.sides], depth: pov.depth, xy: pov.xy, ...who };
      if (snap.fixed) {
        Object.assign(info, { fit: snap.fixed, range: snap.range });
      }
      out.push({ name: points.camera, size, layers: points.pov, info });
    }
    const person = snap.person;
    const fw = person.face ? faceWorld(person, person.face.size[0], person.face.size[1]) : null;
    return out.map(function (c) {
      return { ...c, world: person.world, faceWorld: fw };
    });
  }

  function cameraFiles(prefix, frame, cam) {
    const names = N.fileNames(prefix, frame, cfg.frameDigits, cam.name);
    const sub = N.subFolders(cam.name);
    const [w, h] = cam.size;
    const mp = J.mediapipeJson({ frame, camera: cam.name, width: w, height: h, points: cam.layers.mp, world: cam.world });
    const face = cam.layers.face;
    const files = [
      { sub: sub.op, name: names.opPng, png: toBase64(render.renderOpenPose(cam.layers.op, cam.size)) },
      { sub: sub.op, name: names.opJson, json: J.openposeJson(cam.layers.op, w, h) },
      { sub: sub.mp, name: names.mpJson, json: mp },
      { sub: sub.full, name: names.opPng, png: toBase64(render.renderFull(cam.layers.op, face ? face.op : null, cam.size)) },
    ];
    return face ? files.concat(faceFiles(frame, cam, names, sub)) : files;
  }

  function faceFiles(frame, cam, names, sub) {
    const [w, h] = cam.size;
    const face = cam.layers.face;
    const mp = J.mediapipeJson({ frame, camera: cam.name, width: w, height: h, points: face.mp, world: cam.faceWorld });
    return [
      { sub: sub.faceOp, name: names.opPng, png: toBase64(render.renderOpenFace(face.op, cam.size)) },
      { sub: sub.faceOp, name: names.opJson, json: J.openposeFaceJson(face.op, w, h) },
      { sub: sub.faceMp, name: names.mpJson, json: mp },
    ];
  }

  function record(snap, parts) {
    return {
      version: k.version, shot: parts.shot, character: parts.character, clip: snap.clip, frame: snap.frame,
      fps: snap.fps, time: snap.time, person: snap.pov.person, swapped: !!snap.pose.swapped, edited: snap.person.edited || [],
    };
  }

  async function sheets(folder, names) {
    const out = [];
    for (const name of names) {
      out.push(...(await sheet(folder, name)));
    }
    return out;
  }

  async function sheet(folder, name) {
    const q = `folder=${encodeURIComponent(folder)}&camera=${encodeURIComponent(name)}`;
    const data = await call(`${cfg.export.sheetRoute}?${q}`);
    if (!data.frames || data.frames.length === 0) {
      return [];
    }
    const names = N.fileNames(folder, 0, cfg.frameDigits, name);
    const png = toBase64(render.renderSheet(data.frames, cfg.frameDigits));
    const res = await call(cfg.export.route, { folder, files: [{ sub: N.subFolders(name).sheet, name: names.sheet, png }] });
    return res.written;
  }

  async function ready() {
    if (!state.url) {
      throw new Error(t("noVideo"));
    }
    if (!state.lastPose || state.lastPose.frame !== state.frame) {
      await deps.pose();
    }
    const person = povApi.chosen();
    if (!person) {
      throw new Error(t("noPerson", { n: state.pov.person + 1 }));
    }
    return person;
  }

  function shotName() {
    const parts = N.shotParts({ ...state.pov.names, clip: state.name });
    const problem = N.shotProblem(parts);
    if (problem) {
      throw new Error(t(problem, { shot: parts.shot }));
    }
    return parts;
  }

  // One frame. opts: src (bool), fixed + range (frame range framing), sheets: false = leave the sheets for later.
  async function run(o) {
    const opts = o || {};
    const wantSrc = typeof opts.src === "boolean" ? opts.src : state.pov.srcCamera;
    const wantPov = state.pov.view !== SOURCE_VIEW;
    if (!wantSrc && !wantPov) {
      throw new Error(t("nothingToExport"));
    }
    const parts = shotName();
    const snap = snapshot(await ready(), opts);
    const frame = snap.frame;
    const prefix = N.shotPrefix(parts);
    const cams = cameras(snap, wantSrc, wantPov);
    const names = N.fileNames(prefix, frame, cfg.frameDigits, SRC);
    const prev = await call(`${cfg.export.shotRoute}?folder=${encodeURIComponent(prefix)}&frame=${encodeURIComponent(names.frameJson)}`);
    const files = cams.flatMap(function (c) {
      return cameraFiles(prefix, frame, c);
    });
    const rec = record(snap, parts);
    const camInfo = Object.fromEntries(cams.map(function (c) {
      return [c.name, c.info];
    }));
    files.push({ sub: "zkroto", name: names.frameJson, json: J.frameJson(prev.frame, rec, camInfo) });
    files.push({ sub: "zkroto", name: names.shotJson, json: J.shotJson(prev.shot, rec, frame, Object.keys(camInfo)) });
    const written = (await call(cfg.export.route, { folder: prefix, files })).written;
    const list = cams.map(function (c) {
      return c.name;
    });
    if (opts.sheets !== false) {
      written.push(...(await sheets(prefix, list)));
    }
    ctx.log(t("exportLog", { frame, count: written.length, app: k.app, folder: prefix }));
    ctx.status(t("exported", { prefix, frame: String(frame).padStart(cfg.frameDigits, "0"), parts: list.join(", ") }), "ok");
    state.lastExport = { frame, folder: prefix, files: written, cameras: list };
    return state.lastExport;
  }

  // One Export at a time (a single frame or a whole range): a second one while the first waits on the network
  // would overwrite the shot index. The lock is taken before the first await.
  let busy = false;
  function locked(fn) {
    if (busy) {
      return Promise.reject(new Error(t("exportBusy")));
    }
    busy = true;
    return Promise.resolve().then(fn).finally(function () {
      busy = false;
    });
  }

  return { exportPose: function (opts) {
    return locked(function () {
      return run(opts);
    });
  }, locked, exportFrame: run, sheets };
}
