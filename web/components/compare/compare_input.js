// COMPONENT compare, input part: wheel zooms at the mouse; side by side a drag pans both; wipe mode a drag moves the
// divider only (middle button pans); while open, Esc closes and the arrow keys move the wipe (wipe mode); keys are taken
// before the pen sees them (capture): while open no key reaches the drawing hidden under the panel.
import { wipeAt } from "../../js/zk_compareview.js";

// The mouse in the coordinates of the pane under it (side by side: the right pane starts at half the box).
function inPane(api, e) {
  const b = api.box();
  let x = e.clientX - (b.left || 0);
  const half = api.pane().w;
  if (api.mode() === "side" && x > half) {
    x -= half;
  }
  return { x, y: e.clientY - (b.top || 0) };
}

export function bindInput(o) {
  const { box, handle, cfg, api } = o;
  let drag = null;
  box.addEventListener("wheel", function (e) {
    e.preventDefault();
    api.measure();
    const p = inPane(api, e);
    api.zoom(e.deltaY < 0 ? cfg.request.zoomStep : 1 / cfg.request.zoomStep, p.x, p.y);
  });
  // Wipe mode: a left drag anywhere moves only the divider (Koh 23:3x: the picture must not move); the middle
  // button pans. Side by side: a drag pans both pictures.
  box.addEventListener("pointerdown", function (e) {
    api.measure();
    const wipeMode = api.mode() === "wipe";
    drag = { wipe: e.target === handle || (wipeMode && e.button === 0), x: e.clientX, y: e.clientY };
    if (wipeMode && !drag.wipe && e.button !== 1) {
      drag = null;
      return;
    }
    if (drag.wipe) {
      api.setWipe(wipeAt(e.clientX, api.box().left || 0, api.box().w));
    } else if (e.button === 1) {
      e.preventDefault();
    }
    if (box.setPointerCapture) {
      box.setPointerCapture(e.pointerId);
    }
  });
  box.addEventListener("dragstart", function (e) {
    e.preventDefault();
  });
  box.addEventListener("pointermove", function (e) {
    if (!drag) {
      return;
    }
    if (drag.wipe) {
      api.setWipe(wipeAt(e.clientX, api.box().left || 0, api.box().w));
    } else {
      api.pan(e.clientX - drag.x, e.clientY - drag.y);
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  for (const name of ["pointerup", "pointercancel"]) {
    box.addEventListener(name, function () {
      drag = null;
    });
  }
  globalThis.addEventListener("keydown", function (e) {
    const tag = e.target && e.target.tagName;
    if (!api.isOpen() || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      return;
    }
    if (e.code === "Escape") {
      api.close();
    } else if ((e.code === "ArrowLeft" || e.code === "ArrowRight") && api.mode() === "wipe") {
      api.key(e.code);
    } else {
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  }, true);
  globalThis.addEventListener("resize", function () {
    if (api.isOpen()) {
      api.measure();
      api.fit();
    }
  });
}
