// COMPONENT people: person buttons 1 (blue) / 2 (orange), Swap, Edit (E) point editing and Reset frame (edit mode).
// Shows which person POV and Export use.
import { EVENTS } from "../../js/zk_events.js";
import { el, button, pressed } from "../../js/zk_dom.js";

const PERSONS = [0, 1];

export function mount(host, ctx, parts) {
  const { k, bus, state } = ctx;
  host.append(el("span", { className: "zk-people-label", text: k.ui.person }));
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
  const edit = button(k.ui.editPoints, function () {
    parts.zk.editMode();
  }, "zk-edit");
  const reset = button(k.ui.resetFrame, function () {
    ctx.run(parts.zk.resetFrame);
  }, "zk-reset-frame");
  host.append(edit, reset);

  function update() {
    const pose = state.lastPose;
    buttons.forEach(function (b, i) {
      pressed(b, state.pov.person === i);
      b.classList.toggle("zk-missing", !pose || !pose.people[i]);
    });
    pressed(edit, !!state.editMode);
    reset.hidden = !state.editMode;
  }
  bus.on(EVENTS.pov, update);
  bus.on(EVENTS.pose, update);
  update();
}
