// FACADE part (zk_pen.js): the Fill / Stroke box on the pen (canvas cv_color.js cvColorApply / cvColorSwap /
// cvColorFromSel, cv_tool_view.js cvEyeDown). Every change redraws and tells the page (EVENTS.color) so the
// colour box and the picker follow; the rules themselves are in zk_penstyle.js.
import * as S from "./zk_penstyle.js";
import { findPath } from "./zk_pendoc.js";
import { EVENTS } from "./zk_events.js";

export function createPenColor(ctx, core) {
  const st = core.st;
  function changed() {
    core.draw();
    ctx.bus.emit(EVENTS.color, Object.assign({}, core.style));
    return core.style;
  }
  function apply(hex) {
    const ok = S.applyColor(core.style, st.doc, st.selected, hex);
    changed();
    return ok;
  }
  return {
    style: function () {
      return Object.assign({}, core.style);
    },
    front: function (which) {
      S.setFront(core.style, which);
      changed();
      return core.style.front;
    },
    apply,
    swap: function () {
      S.swap(core.style, st.doc, st.selected);
      return changed();
    },
    opacity: function (value) {
      const op = S.setOpacity(core.style, st.doc, st.selected, value);
      changed();
      return op;
    },
    // Choosing a shape (V or A) shows its colours; nothing chosen leaves the box as it is.
    sync: function () {
      if (S.fromPath(core.style, st.selected ? findPath(st.doc, st.selected) : null)) {
        changed();
      }
    },
    // Eyedropper: the picture's colour under the click (picture pixels) goes to the front square.
    sample: function (p) {
      const hex = core.view && core.view.sample ? core.view.sample(p.x, p.y) : null;
      return hex ? apply(hex) : false;
    },
  };
}
