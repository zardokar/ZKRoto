// COMPONENT (pointer part of the pen facade, zk_pen.js): one pointer owns a gesture (cv_stage_pointer.js); Space
// held or the pan tool drags the view (cv_tool_view.js cvPan*), Z clicks zoom (Alt = out), the other tools go to
// zk_pentools. A capture that throws (pointer gone) never leaves the pen stuck (seen live 2026-11-24).
import * as T from "./zk_pentools.js";
import { inField } from "./zk_penkeys.js";
import { shapeStyle } from "./zk_penstyle.js";
import * as F from "./zk_pentransform.js";
import * as C from "./zk_pencurve.js";

function capture(canvas, id) {
  try {
    canvas.setPointerCapture(id);
  } catch (err) {
    return false;
  }
  return true;
}

// cvKeysTakeFocus: a press on the picture gives the keys back from a field (the frame box kept 0 and V A P Z).
function takeFocus() {
  const active = typeof document === "undefined" ? null : document.activeElement;
  if (active && inField(active) && active.blur) {
    active.blur();
  }
}

export function createPenMouse(ctx, core) {
  const { st, canvas, look, view, mods } = core;

  function startPan(e) {
    core.panFrom = { x: e.clientX, y: e.clientY };
    mods.dragging = true;
  }

  function toolDown(e, p) {
    if (st.tool === "zoom") {
      view.zoomAtClient(e.clientX, e.clientY, e.altKey ? 1 / look.zoomClick : look.zoomClick);
    } else if (st.tool === "pen") {
      T.penDown(st, p, e, core.tol(), shapeStyle(core.style, look));
    } else if (st.tool === "eyedrop") {
      core.color.sample(p);
    } else if (st.tool === "select") {
      if (!F.tfDown(st, p, core.tfTol())) {
        T.selDown(st, p, core.tol());
      }
      core.color.sync();
    } else {
      if (!C.curveDown(st, p, e, core.tol())) {
        T.ptDown(st, p, core.tol());
      }
      core.color.sync();
    }
  }

  function down(e) {
    if (e.isPrimary === false || e.button !== 0) {
      return false;
    }
    e.preventDefault();
    takeFocus();
    core.pointer = e.pointerId;
    capture(canvas, e.pointerId);
    mods.alt = !!e.altKey;
    core.client = { clientX: e.clientX, clientY: e.clientY };
    const p = core.at(e);
    core.mouse = p;
    if (mods.space) {
      startPan(e);
    } else {
      toolDown(e, p);
    }
    core.cursor();
    core.draw();
    return true;
  }

  function move(e) {
    if (core.pointer !== null && e.pointerId !== core.pointer) {
      return false;
    }
    mods.alt = !!e.altKey;
    if (core.panFrom) {
      view.panBy(e.clientX - core.panFrom.x, e.clientY - core.panFrom.y);
      core.panFrom = { x: e.clientX, y: e.clientY };
    } else if (st.tool === "pen") {
      T.penMove(st, core.at(e), core.tol());
    } else if (st.grab && st.grab.curve) {
      C.curveMove(st, core.at(e), e);
    } else if (st.grab && st.grab.transform) {
      F.tfMove(st, core.at(e), e, core.tfTol());
    } else if (st.tool === "select" || st.tool === "point") {
      T.selMove(st, core.at(e));
    }
    core.client = { clientX: e.clientX, clientY: e.clientY };
    core.mouse = core.at(e);
    core.cursor();
    core.draw();
    return true;
  }

  function up(e) {
    if (core.pointer !== null && e.pointerId !== core.pointer) {
      return false;
    }
    core.pointer = null;
    core.panFrom = null;
    mods.dragging = false;
    T.penUp(st);
    core.cursor();
    core.draw();
    return true;
  }

  // pointercancel (touch / pen lost): a transform goes back to the press, then the same end as a release.
  function cancel(e) {
    F.tfCancel(st);
    return up(e);
  }

  // The mouse left the pen: no guide line or hover state stays at the last place.
  function leave() {
    core.mouse = null;
    core.client = null;
    core.draw();
  }

  return { down, move, up, cancel, leave };
}
