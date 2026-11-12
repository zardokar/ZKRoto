// COMPONENT views: view switch Source | POV | Split (key V cycles them).
import { EVENTS } from "../../js/zk_events.js";
import { el, button, pressed } from "../../js/zk_dom.js";

export function mount(host, ctx, parts) {
  const { cfg, k, bus, state } = ctx;
  host.append(el("span", { className: "zk-views-label", text: k.ui.view }));
  const buttons = cfg.pov.views.map(function (v) {
    const b = button(k.ui[v], function () {
      parts.pov.view(v);
    }, "zk-view");
    host.append(b);
    return b;
  });
  host.append(el("span", { className: "zk-views-hint", text: k.ui.nextViewHint }));

  function update() {
    buttons.forEach(function (b, i) {
      pressed(b, cfg.pov.views[i] === state.pov.view);
    });
  }
  bus.on(EVENTS.pov, update);
  update();
}
