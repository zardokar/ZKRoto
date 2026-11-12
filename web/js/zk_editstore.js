// SERVICE (no UI): point editing of the shown frame. Edit mode, move / reset a MediaPipe point of the chosen person,
// reset the frame; the edits live in zkroto\<shot>_<character>_edits.json (read and written through the existing
// routes) and are put on every pose of the shot (apply). The MediaPipe pose stays as pose.raw.
import * as E from "./zk_edits.js";
import { shotParts, shotProblem, shotPrefix } from "./zk_naming.js";
import { EVENTS } from "./zk_events.js";

const POINTS = 33;
const JSON_HEADERS = { "Content-Type": "application/json" };

export function createEditStore(ctx, deps) {
  const { cfg, state, t, bus } = ctx;
  let cache = { key: null, doc: null };

  function folder() {
    const names = { ...state.pov.names, clip: state.name };
    const problem = shotProblem(shotParts(names));
    if (problem) {
      throw new Error(t(problem, { shot: shotParts(names).shot }));
    }
    return shotPrefix(names);
  }

  async function call(url, body) {
    const opts = body ? { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) } : {};
    const r = await deps.fetch(url, opts);
    const data = await r.json().catch(function () {
      return {};
    });
    if (!r.ok) {
      throw new Error(t("exportFailed", { status: r.status, message: data.error || "" }));
    }
    return data;
  }

  // The edits of the current shot folder and clip, read once per folder.
  async function ensure() {
    const prefix = folder();
    const key = `${prefix}|${state.name}`;
    if (cache.key !== key) {
      const name = `${prefix}_edits.json`;
      const data = await call(`${cfg.export.shotRoute}?folder=${encodeURIComponent(prefix)}&frame=${encodeURIComponent(name)}`);
      const { doc, problem } = E.parseEdits(data.frame, state.name);
      if (problem) {
        ctx.log(t(problem, { file: name, clip: (data.frame && data.frame.clip) || "?" }));
      }
      cache = { key, doc, prefix };
    }
    return cache;
  }

  async function apply(pose) {
    try {
      return E.applyEdits(pose, (await ensure()).doc);
    } catch (e) {
      ctx.log(t("error", { message: e.message }));
      return pose;
    }
  }

  function shown() {
    const pose = state.lastPose;
    if (!pose || pose.frame !== state.frame) {
      throw new Error(t("noPose"));
    }
    return pose;
  }

  async function change(fn) {
    const pose = shown();
    const c = await ensure();
    c.doc = fn(c.doc, pose);
    state.lastPose = E.applyEdits(state.lastPose, c.doc);
    bus.emit(EVENTS.pose, state.lastPose);
    const name = `${c.prefix}_edits.json`;
    await call(cfg.export.route, { folder: c.prefix, files: [{ sub: "zkroto", name, json: c.doc }] });
    return state.lastPose;
  }

  function checkIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= POINTS) {
      throw new Error(t("badPoint", { index }));
    }
  }

  return {
    apply,
    mode: function (on) {
      if (on !== undefined) {
        state.editMode = !!on;
        bus.emit(EVENTS.pov, state.pov);
      }
      return !!state.editMode;
    },
    // x, y in pixels of the video frame.
    movePoint: async function (index, x, y) {
      checkIndex(index);
      return change(function (doc, pose) {
        return E.setPoint(doc, pose.frame, state.pov.person, index, [x / pose.width, y / pose.height]);
      });
    },
    resetPoint: async function (index) {
      checkIndex(index);
      return change(function (doc, pose) {
        return E.clearPoint(doc, pose.frame, state.pov.person, index);
      });
    },
    resetFrame: async function () {
      return change(function (doc, pose) {
        return E.clearFrame(doc, pose.frame);
      });
    },
    edits: async function () {
      return (await ensure()).doc;
    },
  };
}
