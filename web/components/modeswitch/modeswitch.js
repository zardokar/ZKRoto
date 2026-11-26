// COMPONENT modeswitch: Mask | Roto right after the title (wf_modes round 1, Koh OK 2026-11-26 17:54 "ok ทำได้เลย").
// Icons with themed tips; pressed = the mode on; a press sets the mode. The file picks it first (zk_modeview.js).
import { EVENTS } from "../../js/zk_events.js";
import { icon } from "../../js/zk_reqicons.js";
import { pressed } from "../../js/zk_dom.js";

const MODES = ["mask", "roto"];
const TIP = { mask: "modeMask", roto: "modeRoto" };

export function mount(host, ctx, parts) {
  const { k, bus } = ctx;
  const buttons = MODES.map(function (m) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "zk-req-btn zk-mode-btn";
    b.dataset.mode = m;
    b.dataset.tip = k.ui[TIP[m]];
    b.innerHTML = icon(m);
    b.onclick = function () {
      parts.mode.set(m);
    };
    host.append(b);
    return b;
  });
  function update(d) {
    buttons.forEach(function (b, i) {
      pressed(b, MODES[i] === d.mode);
    });
  }
  bus.on(EVENTS.mode, update);
  update({ mode: parts.mode.get() });
}
