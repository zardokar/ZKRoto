// PHYSICAL: the mode on the page: body data-zk-mode / data-zk-source drive the CSS. Roto keeps the pen layer hidden
// with the Zoom tool on; Mask gets its own tool back (the drawing is kept). Leaving Roto ends point editing (else the
// pen stays blocked in Mask), leaving Mask closes the colour picker (docs/zk_api.js.md, zk.mode).
import { EVENTS } from "./zk_events.js";

export function bindModeView(ctx, parts, doc) {
  const { mode, pen, zk } = parts;
  ctx.modeNow = mode.get;
  ctx.sourceNow = mode.source;
  let maskTool = null;
  ctx.bus.on(EVENTS.mode, function (d) {
    doc.body.dataset.zkMode = d.mode;
    doc.body.dataset.zkSource = d.source;
    if (d.mode !== "roto" && ctx.state.editMode) {
      zk.editMode(false);
    }
    if (d.mode !== "mask") {
      ctx.bus.emit(EVENTS.picker, { open: false });
    }
    if (d.mode === "roto" && pen.tool() !== "zoom") {
      maskTool = pen.tool();
      pen.tool("zoom");
    } else if (d.mode === "mask" && maskTool) {
      pen.tool(maskTool);
      maskTool = null;
    }
  });
  ctx.bus.on(EVENTS.source, function (d) {
    mode.loaded(!!d.still);
  });
}
