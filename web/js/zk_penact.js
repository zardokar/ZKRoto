// FACADE part (zk_pen.js): what a key action does (canvas cv_key_edit.js cvKeyEditCmd, cvKeyEscape, cvKeyDelete):
// tools, finish / cancel / step of the open line, choice, fit, Space, X swap, / no colour, delete.
import * as T from "./zk_pentools.js";
import { deletePath } from "./zk_pendoc.js";
import { tfCancel } from "./zk_pentransform.js";
import { stepHistory } from "./zk_penhistory.js";

// Ctrl+Z while an A / V drag runs is ignored (the drag would be lost); during a transform the box goes back first.
function undo(core, st, back) {
  if (st.grab && !st.grab.transform) {
    return;
  }
  tfCancel(st);
  stepHistory(core.history, st, back);
}

export function act(core, tool, color, a) {
  const st = core.st;
  if (a.kind === "tool") {
    tool(a.name);
  } else if (a.kind === "finish") {
    T.penFinish(st);
  } else if (a.kind === "untransform") {
    tfCancel(st);
  } else if (a.kind === "cancel") {
    T.penCancel(st);
  } else if (a.kind === "step") {
    T.penStep(st, a.back);
  } else if (a.kind === "undo") {
    undo(core, st, a.back);
  } else if (a.kind === "deselect") {
    st.selected = null;
  } else if (a.kind === "fit") {
    core.view.fit();
  } else if (a.kind === "swap") {
    color.swap();
  } else if (a.kind === "none") {
    color.apply("none");
  } else if (a.kind === "mod") {
    core.mods.space = true;
  } else if (st.pen && st.selected === st.pen) {
    T.penCancel(st);
  } else {
    tfCancel(st);
    deletePath(st.doc, st.selected);
    st.selected = null;
    st.grab = null;
    st.active = null;
  }
}
