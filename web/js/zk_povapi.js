// FACADE for the POV settings and the chosen person: every change goes through here and is announced on the bus
// (EVENTS.pov / EVENTS.pose). Components and window.zk call only these functions.
import * as S from "./zk_povstate.js";
import { EVENTS } from "./zk_events.js";
import { swapPose } from "./zk_poseshape.js";
import { outSize } from "./zk_outsize.js";
import { cameraName } from "./zk_naming.js";
import { povPoints, srcPoints } from "./zk_pov.js";

export function createPovApi(ctx) {
  const { cfg, state, bus, t } = ctx;
  state.pov = S.povDefaults(cfg);

  function set(next) {
    if (next === null) {
      return null;
    }
    state.pov = next;
    bus.emit(EVENTS.pov, state.pov);
    return state.pov;
  }

  function size() {
    const s = outSize(state.pov.outMode, state.pov.custom, cfg.pov);
    return { ...s, mode: state.pov.outMode };
  }

  function chosenPerson() {
    const pose = state.lastPose;
    return pose ? pose.people[state.pov.person] || null : null;
  }

  // Both layers of the chosen person: POV camera (out size, framing) and source camera (video size).
  // fixed (optional): one framing transform given from outside (frame range); { s: 1, tx: 0, ty: 0 } = unframed.
  function points(fixed) {
    const p = chosenPerson();
    if (!p) {
      return null;
    }
    const s = size();
    const side = state.side ? { person: state.side.person, width: state.side.width, height: state.side.height } : null;
    const frame = { width: state.lastPose.width, height: state.lastPose.height, side };
    const pov = povPoints(p, state.pov, [s.width, s.height], cfg, frame, fixed);
    const src = srcPoints(p, state.lastPose.width, state.lastPose.height, state.pov.threshold);
    return { pov, src, size: s, camera: cameraName(state.pov.camera, s) };
  }

  function swap() {
    if (!state.lastPose) {
      throw new Error(t("noPose"));
    }
    state.lastPose = swapPose(state.lastPose);
    bus.emit(EVENTS.pose, state.lastPose);
    ctx.log(t("swapped", { frame: state.lastPose.frame }));
    return state.lastPose;
  }

  return {
    get: function () {
      return state.pov;
    },
    view: function (v) {
      return set(S.setOptions(state.pov, { view: v }, cfg));
    },
    nextView: function () {
      return set(S.setOptions(state.pov, { view: S.nextView(state.pov.view, cfg.pov.views) }, cfg));
    },
    person: function (i) {
      return set(S.setOptions(state.pov, { person: i }, cfg));
    },
    camera: function (patch) {
      return set(S.setCamera(state.pov, patch || {}, cfg)).camera;
    },
    preset: function (name) {
      const next = set(S.applyPreset(state.pov, name, cfg));
      return next ? next.camera : null;
    },
    reset: function () {
      return set(S.resetCamera(state.pov, cfg)).camera;
    },
    orbit: function (dx, dy) {
      return set(S.orbit(state.pov, dx, dy, cfg));
    },
    zoom: function (dy) {
      return set(S.zoom(state.pov, dy, cfg));
    },
    options: function (patch) {
      return set(S.setOptions(state.pov, patch || {}, cfg));
    },
    swap,
    size,
    chosen: chosenPerson,
    points,
  };
}
