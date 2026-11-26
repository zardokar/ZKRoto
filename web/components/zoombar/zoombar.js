// COMPONENT zoombar: Fit | - | % | + of the canvas module (canvas.html #cvZoomGrp, cv_head.js cvHeadZoomLabel), shown
// only while the Z tool is on (cv_menu.js cvZoomVisible). - and + zoom at the stage centre; the % follows the view.
// Talks to the pen only through parts.pen (tool, view); tips are themed (z-ui: no title).
import { EVENTS } from "../../js/zk_events.js";
import { el } from "../../js/zk_dom.js";

function zoomButton(text, tip, className, onClick) {
  return el("button", { text, className, attrs: { type: "button", "data-tip": tip, "aria-label": tip },
    on: { click: onClick } });
}

export function mount(host, ctx, parts) {
  const { cfg, k, bus } = ctx;
  const view = parts.pen.view;
  const step = cfg.pen.zoomStep;
  const label = el("span", { className: "zk-zoom-pct mono" });
  host.append(zoomButton(k.ui.zoomFit, k.ui.zoomTips.fit, "zk-zoom-btn", function () {
    view.fit();
  }), zoomButton("−", k.ui.zoomTips.out, "zk-zoom-btn", function () {
    view.zoomCenter(1 / step);
  }), label, zoomButton("+", k.ui.zoomTips.in, "zk-zoom-btn", function () {
    view.zoomCenter(step);
  }));
  function update() {
    label.textContent = view.percent() + "%";
  }
  function show(tool) {
    host.hidden = tool !== "zoom";
  }
  view.onChange(update);
  bus.on(EVENTS.pen, function (d) {
    show(d.tool);
  });
  show(parts.pen.tool());
  update();
}
