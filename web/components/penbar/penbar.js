// COMPONENT penbar: one vertical tool bar like the canvas module's left bar (canvas.html nav.cv-toolbar,
// cv_head.js cvToolButton): icon + key letter, the current tool lit; order V A P Z = CV_TOOL_ORDER.
// Icons = the cursor pictures (zk_penicons.js); texts from constants; talks to the pen only through parts.pen.
import { EVENTS } from "../../js/zk_events.js";
import { el, pressed } from "../../js/zk_dom.js";
import { ICONS } from "../../js/zk_penicons.js";

function toolButton(name, text, onClick) {
  const btn = el("button", { className: "zk-tool", attrs: { type: "button", "data-tool": name,
    "data-tip": `${text.label} (${text.key})`, "aria-label": text.label }, on: { click: onClick } });
  btn.dataset.tool = name;
  btn.innerHTML = `<img class="zk-tool-ico" src="${ICONS[name].uri}" alt=""><span class="zk-tool-key">${text.key}</span>`;
  return btn;
}

export function mount(host, ctx, parts) {
  const { cfg, k, bus } = ctx;
  const buttons = cfg.pen.tools.map(function (name) {
    return toolButton(name, k.ui.penTools[name], function () {
      parts.pen.tool(name);
    });
  });
  function light(tool) {
    for (const btn of buttons) {
      pressed(btn, btn.dataset.tool === tool);
    }
  }
  host.append(...buttons);
  bus.on(EVENTS.pen, function (d) {
    light(d.tool);
  });
  light(parts.pen.tool());
}
