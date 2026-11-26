// COMPONENT views (Roto): pose overlay eye toggle + Source | POV | Split (key W cycles them). The eye replaces the
// browser checkbox (z-ui Never; wf_modes round 1): the hidden #showPose stays the model the overlay reads.
import { EVENTS } from "../../js/zk_events.js";
import { button, pressed } from "../../js/zk_dom.js";
import { icon } from "../../js/zk_reqicons.js";

function eyeToggle(ctx) {
  const box = ctx.el.showPose;
  const eye = document.createElement("button");
  eye.type = "button";
  eye.className = "zk-req-btn zk-eye";
  eye.dataset.tip = ctx.k.ui.poseOverlayTip;
  eye.innerHTML = icon("eye");
  eye.onclick = function () {
    box.checked = !box.checked;
    box.dispatchEvent(new Event("change"));
    pressed(eye, box.checked);
  };
  pressed(eye, box.checked);
  return eye;
}

export function mount(host, ctx, parts) {
  const { cfg, k, bus, state } = ctx;
  host.append(eyeToggle(ctx));
  const buttons = cfg.pov.views.map(function (v) {
    const b = button(k.ui[v], function () {
      parts.pov.view(v);
    }, "zk-view");
    host.append(b);
    return b;
  });
  function update() {
    buttons.forEach(function (b, i) {
      pressed(b, cfg.pov.views[i] === state.pov.view);
    });
  }
  bus.on(EVENTS.pov, update);
  update();
}
