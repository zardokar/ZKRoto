// FACADE of the pen (0.4.0 work), Koh's canvas module ported (cv_tools.js, cv_key_*.js, cv_cursor.js, cv_color.js):
// tools V select, A point, P pen, Z zoom, I eyedrop (+ Space = temporary pan); core -> zk_pencore, keys -> zk_penkeys +
// zk_penact, mouse -> zk_penmouse, Fill / Stroke -> zk_pencolor. Starts on select.
import { penKey } from "./zk_penkeys.js";
import { createPenMouse } from "./zk_penmouse.js";
import { makeCore, makeTool } from "./zk_pencore.js";
import { act } from "./zk_penact.js";
import { createPenColor } from "./zk_pencolor.js";
import * as T from "./zk_pentools.js";
import { newHistory, resetHistory, settle as settleHistory } from "./zk_penhistory.js";
import { addPath } from "./zk_pendoc.js";
import { rotoPenKey } from "./zk_mode.js";

export function createPen(ctx, view) {
  const core = makeCore(ctx, view);
  const st = core.st;
  const tool = makeTool(ctx, core);
  const color = createPenColor(ctx, core);
  core.color = color;
  const mouse = createPenMouse(ctx, core);
  core.history = newHistory(ctx.cfg.pen.historyMax);
  resetHistory(core.history, st);

  // An action may have ended (canvas cvHistEnd): an open line or a running drag stays one gesture.
  function settle() {
    settleHistory(core.history, st);
  }

  function key(e) {
    if (!core.canvas.getBoundingClientRect().width) {
      return false;
    }
    core.mods.alt = !!e.altKey;
    const a = penKey(e, { tool: st.tool, drawing: !!st.pen, selected: st.selected,
      transforming: !!(st.grab && st.grab.transform) });
    const roto = !!(a && ctx.modeNow && ctx.modeNow() === "roto" && !rotoPenKey(a));
    if (!a || roto || (ctx.state && ctx.state.editMode && a.kind !== "fit")) {
      core.cursor();
      return false;
    }
    e.preventDefault();
    settle();
    act(core, tool, color, a);
    settle();
    core.cursor();
    core.draw();
    return true;
  }

  // cvKeyUp: releasing Space gives the tool back; Alt changes the cursor (zoom out, pen curve).
  function keyUp(e) {
    settle();
    core.mods.alt = !!e.altKey;
    if (e.code === "Space" || e.key === " ") {
      core.mods.space = false;
      core.release(false);
    }
    core.cursor();
  }

  // The window lost focus: a key or button let go elsewhere never reaches the page.
  function blur() {
    core.release(true);
    settle();
    core.cursor();
    core.draw();
  }

  // The view moved under a still mouse: what is under it, and the screen-sized handles, change.
  function viewChanged() {
    if (core.client) {
      core.mouse = core.at(core.client);
    }
    core.cursor();
    core.draw();
  }

  // A new picture: the old paths no longer belong to it, and the view fits it again.
  function reset() {
    st.doc = T.newState().doc;
    st.pen = null;
    st.grab = null;
    st.selected = null;
    st.active = null;
    st.undone = [];
    core.pointer = null;
    resetHistory(core.history, st);
    view.fit();
    core.draw();
  }

  // A new picture size (picture pixels); on the page the canvas itself follows the pane (view.backing).
  function resize(w, h) {
    core.size = { w, h };
    if (!(view && view.backing)) {
      core.canvas.width = w;
      core.canvas.height = h;
    }
    core.draw();
  }

  if (view && view.onChange) {
    view.onChange(viewChanged);
  }
  core.cursor();
  // Page cursor mode (bindPen): the page draws the cursor (contrast); hide the system one and say each change.
  function softCursor(fn) {
    core.soft = fn;
    core.cursor();
  }

  // Every way an action ends settles the history (review 2026-11-24): a press, a release anywhere, a cancel, a
  // tool picked on the toolbar (its click comes after the pointerup).
  function up(e) {
    mouse.up(e);
    settle();
  }
  function pick(name) {
    const now = tool(name);
    settle();
    return now;
  }

  // Import (Koh 2026-11-25): shapes ADDED after the drawn ones as ONE undo step; a single shape is chosen (V box).
  function addPaths(list) {
    settle();
    for (const spec of list) {
      addPath(st.doc, JSON.parse(JSON.stringify(spec)));
    }
    if (!list.length) {
      return 0;
    }
    st.selected = list.length === 1 ? st.doc.paths[st.doc.paths.length - 1].id : null;
    if (st.selected) {
      tool("select");
    }
    settle();
    core.draw();
    return list.length;
  }

  return { tool: pick, key, addPaths, keyUp, blur, reset, resize, view, color, softCursor, settle, up, windowUp: up,
    move: mouse.move, down: function (e) {
      settle();
      mouse.down(e);
    }, draw: core.draw, cancel: function (e) {
      mouse.cancel(e);
      settle();
    }, leave: mouse.leave,
    doc: function () {
      return st.doc;
    }, state: function () {
      return st;
    }, cursor: function () {
      return core.cursorName;
    } };
}
