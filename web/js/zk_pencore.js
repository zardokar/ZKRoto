// FACADE part (zk_pen.js): the pen's shared core - state, Fill / Stroke box, screen <-> canvas pixels, drawing, the
// cursor - and the tool switch (canvas cv_tools.js cvToolActivate). Tolerances are screen pixels in canvas pixels.
import * as T from "./zk_pentools.js";
import { drawPen } from "./zk_pendraw.js";
import { cursorFor, cursorCss } from "./zk_pencursor.js";
import { ICONS } from "./zk_penicons.js";
import { newStyle } from "./zk_penstyle.js";
import { tfCancel } from "./zk_pentransform.js";
import { EVENTS } from "./zk_events.js";

const FIRST_TOOL = "select";
const CURSOR_FALLBACK = "crosshair";

export function makeCore(ctx, view) {
  const look = ctx.cfg.pen;
  const canvas = ctx.el.pen;
  const st = T.newState();
  st.tool = FIRST_TOOL;
  const core = { st, look, canvas, view, mods: { alt: false, space: false, dragging: false }, mouse: null,
    pointer: null, panFrom: null, client: null, cursorName: null, style: newStyle(look),
    size: { w: canvas.width || 1, h: canvas.height || 1 } };
  // The picture on screen (page: the zoomed still / video; tests: the canvas box); picture px per screen px.
  core.box = function () {
    return view && view.box ? view.box() : canvas.getBoundingClientRect();
  };
  core.zoom = function () {
    const r = core.box();
    return r.width ? core.size.w / r.width : 1;
  };
  core.at = function (e) {
    const r = core.box();
    const z = core.zoom();
    return { x: (e.clientX - r.left) * z, y: (e.clientY - r.top) * z };
  };
  core.tol = function () {
    const z = core.zoom();
    return { line: look.hitTolPx * z, point: look.hitTolPointPx * z, bend: look.bezierDragPx * z };
  };
  // Page: clear the screen-size canvas, then draw picture pixels through picture -> screen (sharp vectors).
  core.draw = function () {
    const g = canvas.getContext("2d");
    const fit = view && view.backing ? view.backing(canvas) : null;
    if (fit) {
      const r = core.box();
      const k = (r.width / core.size.w) * fit.dpr;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(k, 0, 0, k, (r.left - fit.left) * fit.dpr, (r.top - fit.top) * fit.dpr);
    }
    drawPen(g, st, core.mouse, look, core.zoom(), core.size);
  };
  // cvStageCursorSync: recomputed whenever the tool, the keys held or what is under the mouse changes.
  core.cursor = function () {
    const kind = st.tool === "pen" && core.mouse ? T.hoverKind(st, core.mouse, core.tol()) : null;
    core.cursorName = cursorFor(st.tool, kind, core.mods);
    canvas.style.cursor = core.soft ? "none" : cursorCss(ICONS, core.cursorName, CURSOR_FALLBACK);
    if (core.soft) {
      core.soft(core.cursorName);
    }
  };
  // Keys and drags held end together (Space up, window blur, tool switch): no pan is left running.
  core.tfTol = function () {
    const z = core.zoom();
    return { hit: look.transformHitPx * z, rotate: look.transformRotatePx * z, min: look.transformMinSize,
      snap: look.transformSnapDegrees };
  };
  core.release = function (all) {
    core.mods.dragging = false;
    core.panFrom = null;
    if (all) {
      tfCancel(core.st);
      core.mods.alt = false;
      core.mods.space = false;
      core.pointer = null;
      core.st.grab = null;
    }
  };
  return core;
}

export function makeTool(ctx, core) {
  return function tool(name) {
    const st = core.st;
    if (name === undefined || !ctx.cfg.pen.tools.includes(name)) {
      return st.tool;
    }
    if (st.pen && name !== "pen") {
      T.penFinish(st);
    }
    tfCancel(st);
    st.active = name === "point" ? st.active : null;
    st.tool = name;
    st.grab = null;
    core.pointer = null;
    core.release(false);
    ctx.bus.emit(EVENTS.pen, { tool: name });
    core.cursor();
    core.draw();
    return st.tool;
  };
}
