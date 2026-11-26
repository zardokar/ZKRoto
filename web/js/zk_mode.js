// LOGICAL: which work the page shows (Koh 2026-11-26 16:4x): a still opens Mask, a video opens Roto, the switch changes
// it; the other mode's work is kept (only hidden). No file yet = no mode. Wireframe: .dropzone/lab/20261126_zkroto_modes.
export const MODES = ["mask", "roto"];

export function modeFor(still) {
  return still ? "mask" : "roto";
}

// Roto draws nothing: of the pen's keys only Fit (0), Space (hold = pan) and the Zoom tool (Z) work there (ui_policy L1).
export function rotoPenKey(a) {
  return a.kind === "fit" || a.kind === "mod" || (a.kind === "tool" && a.name === "zoom");
}

export function createMode(bus, events) {
  let mode = null;
  let source = "none";
  function set(m) {
    if (!MODES.includes(m)) {
      throw new Error("bad mode: " + m);
    }
    mode = m;
    bus.emit(events.mode, { mode, source });
    return mode;
  }
  function loaded(still) {
    source = still ? "still" : "video";
    return set(modeFor(still));
  }
  return {
    set,
    loaded,
    get: function () {
      return mode;
    },
    source: function () {
      return source;
    },
  };
}
