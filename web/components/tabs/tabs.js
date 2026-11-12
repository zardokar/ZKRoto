// COMPONENT tabs: Camera | Points above the panel; which components belong to a tab is set in config.layout.tabs.
import { EVENTS } from "../../js/zk_events.js";
import { button, pressed } from "../../js/zk_dom.js";

export function mount(host, ctx, parts) {
  const { cfg, k, bus, state } = ctx;
  const names = Object.keys(cfg.layout.tabs);
  const buttons = names.map(function (name) {
    const b = button(k.ui[name], function () {
      parts.pov.options({ tab: name });
    }, "zk-tab");
    host.append(b);
    return b;
  });

  function update() {
    buttons.forEach(function (b, i) {
      pressed(b, names[i] === state.pov.tab);
    });
  }
  bus.on(EVENTS.pov, update);
  update();
}
