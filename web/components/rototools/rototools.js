// COMPONENT rototools: the Roto left bar (ui_policy L1, Koh 2026-11-26 17:54): Move point (E) and Zoom (Z) work as a
// pair (one pressed), then Reset frame, dimmed until points are being moved, so nothing in the bar moves when E is
// pressed (live check 2026-11-26). Same look as the pen tools (.zk-tool); talks through parts.zk and parts.pen only.
import { EVENTS } from "../../js/zk_events.js";
import { el, pressed } from "../../js/zk_dom.js";
import { icon } from "../../js/zk_reqicons.js";
import { ICONS } from "../../js/zk_penicons.js";

function tool(tip, inner, onClick) {
  const b = el("button", { className: "zk-tool", attrs: { type: "button", "data-tip": tip, "aria-label": tip },
    on: { click: onClick } });
  b.innerHTML = inner;
  return b;
}

export function mount(host, ctx, parts) {
  const { k, bus, state } = ctx;
  const move = tool(k.ui.editPoints, icon("movepoint") + '<span class="zk-tool-key">E</span>', function () {
    parts.zk.editMode();
  });
  const reset = tool(k.ui.resetFrame, icon("reset"), function () {
    ctx.run(parts.zk.resetFrame);
  });
  const zoom = tool(`${k.ui.penTools.zoom.label} (${k.ui.penTools.zoom.key})`,
    `<img class="zk-tool-ico" src="${ICONS.zoom.uri}" alt=""><span class="zk-tool-key">Z</span>`, function () {
      if (state.editMode) {
        parts.zk.editMode(false);
      }
      parts.pen.tool("zoom");
    });
  host.append(move, zoom, reset);
  function update() {
    pressed(move, !!state.editMode);
    reset.disabled = !state.editMode;
    pressed(zoom, !state.editMode);
  }
  bus.on(EVENTS.pov, update);
  bus.on(EVENTS.pose, update);
  update();
}
