// COMPONENT people (Roto): person buttons 1 (blue) / 2 (orange) and Swap; shows which person POV and Export use.
// Move point (E) and Reset frame live in the Roto left bar (rototools, ui_policy L1, Koh 2026-11-26 17:54).
import { EVENTS } from "../../js/zk_events.js";
import { button, pressed } from "../../js/zk_dom.js";

const PERSONS = [0, 1];

export function mount(host, ctx, parts) {
  const { k, bus, state } = ctx;
  const buttons = PERSONS.map(function (i) {
    const b = button(String(i + 1), function () {
      parts.pov.person(i);
    }, `zk-person zk-person-${i + 1}`);
    host.append(b);
    return b;
  });
  host.append(button(k.ui.swap, function () {
    ctx.run(parts.pov.swap);
  }, "zk-swap"));
  function update() {
    const pose = state.lastPose;
    buttons.forEach(function (b, i) {
      pressed(b, state.pov.person === i);
      b.classList.toggle("zk-missing", !pose || !pose.people[i]);
    });
  }
  bus.on(EVENTS.pov, update);
  bus.on(EVENTS.pose, update);
  update();
}
