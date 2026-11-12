// SERVICE (no UI): Export a frame range. Pass 1 poses every frame; one framing is fitted on all POV joints; pass 2
// exports each frame with it (written into the zkroto frame JSON), sheets once at the end. docs/zk_api.js.md.
import { rangeFit } from "./zk_framing.js";
import { EVENTS } from "./zk_events.js";

const SOURCE_VIEW = "source";
const FIT = "fit";
const UNFRAMED = { s: 1, tx: 0, ty: 0 };

function isInt(v) {
  return Number.isInteger(v);
}

export function createRange(ctx, deps) {
  const { state, t, bus } = ctx;
  const { seek, pose, povApi, exporter } = deps;
  let stopping = false;

  // Empty from / to = the whole clip; a still has one frame (0).
  function bounds(opts) {
    const last = state.still ? 0 : state.total - 1;
    const from = opts.from === undefined || opts.from === null || opts.from === "" ? 0 : Number(opts.from);
    const want = opts.to === undefined || opts.to === null || opts.to === "" ? last : Number(opts.to);
    const to = state.still ? 0 : want;
    if (!state.url || !isInt(from) || !isInt(to) || from < 0 || to > last || from > to) {
      throw new Error(t("rangeBad", { from: opts.from ?? "", to: opts.to ?? "", last }));
    }
    return { from, to };
  }

  function progress(key, i, n, frame) {
    ctx.status(t(key, { i, n, frame }));
  }

  // Pass 1: pose of every frame; returns { frame -> pose } for frames with the chosen person, and the missing ones.
  async function poseAll(r) {
    const poses = new Map();
    const missing = [];
    const n = r.to - r.from + 1;
    for (let f = r.from; f <= r.to && !stopping; f += 1) {
      progress("rangePose", f - r.from + 1, n, f);
      await seek(f);
      const p = await pose();
      if (povApi.chosen()) {
        poses.set(f, p);
      } else {
        missing.push(f);
      }
    }
    return { poses, missing };
  }

  // One transform from the unframed POV joints of every frame (only for the POV camera in "fit" framing).
  async function fitAll(poses) {
    const wantPov = state.pov.view !== SOURCE_VIEW;
    if (!wantPov || state.pov.framing !== FIT || poses.size === 0) {
      return null;
    }
    const ops = [];
    for (const p of poses.values()) {
      state.lastPose = p;
      ops.push(povApi.points(UNFRAMED).pov.op);
    }
    const s = povApi.size();
    return rangeFit(ops, [s.width, s.height], state.pov.margins);
  }

  async function exportAll(r, poses, fixed, opts) {
    let exported = 0;
    let last = null;
    const frames = [...poses.keys()];
    for (const f of frames) {
      if (stopping) {
        break;
      }
      progress("rangeExport", exported + 1, frames.length, f);
      await seek(f);
      state.lastPose = poses.get(f);
      bus.emit(EVENTS.pose, state.lastPose);
      last = await exporter.exportFrame({ src: opts.src, fixed, range: fixed ? [r.from, r.to] : undefined, sheets: false });
      exported += 1;
    }
    if (last) {
      await exporter.sheets(last.folder, last.cameras);
    }
    return { exported, folder: last ? last.folder : null };
  }

  async function run(opts) {
    const r = bounds(opts);
    stopping = false;
    const { poses, missing } = await poseAll(r);
    const fixed = stopping ? null : await fitAll(poses);
    const done = stopping ? { exported: 0, folder: null } : await exportAll(r, poses, fixed, opts);
    const out = { from: r.from, to: r.to, exported: done.exported, missing, stopped: stopping, folder: done.folder, fit: fixed };
    const key = stopping ? "rangeStopped" : "rangeDone";
    ctx.status(t(key, { n: out.exported, from: r.from, to: r.to, missing: missing.length }), stopping ? "" : "ok");
    ctx.log(t(key, { n: out.exported, from: r.from, to: r.to, missing: missing.length }) +
      (missing.length ? ` ${t("rangeMissing", { frames: missing.join(", ") })}` : ""));
    stopping = false;
    return out;
  }

  return {
    exportRange: function (opts) {
      return exporter.locked(function () {
        return run(opts || {});
      });
    },
    stop: function () {
      stopping = true;
    },
  };
}
