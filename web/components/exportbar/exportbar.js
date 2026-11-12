// COMPONENT exportbar: Export (Ctrl+E), the "source camera" checkbox, the two name fields (shot, character) and
// Export range: frames from / to (empty = whole clip); the button turns into Stop while a range runs.
import { EVENTS } from "../../js/zk_events.js";
import { el, button, setValue } from "../../js/zk_dom.js";

function field(labelText, placeholder, onInput, size) {
  const input = el("input", { className: "zk-name", attrs: { placeholder, size: size || 12 },
    on: onInput ? { input: onInput } : {} });
  const label = el("label", { className: "zk-field" });
  label.append(el("span", { text: labelText }), input);
  return { label, input };
}

const RANGE_SIZE = 5;

function rangeParts(ctx, parts) {
  const { k } = ctx;
  const from = field(k.ui.rangeFrom, k.ui.rangeAll, null, RANGE_SIZE);
  const to = field(k.ui.rangeTo, k.ui.rangeAll, null, RANGE_SIZE);
  let running = false;
  const btn = button(k.ui.exportRange, async function () {
    if (running) {
      parts.zk.stopRange();
      return;
    }
    running = true;
    btn.textContent = k.ui.stopRange;
    await ctx.run(parts.zk.exportRange, { from: from.input.value.trim(), to: to.input.value.trim() });
    running = false;
    btn.textContent = k.ui.exportRange;
  }, "zk-export-range");
  return [btn, from.label, to.label];
}

export function mount(host, ctx, parts) {
  const { k, bus, state } = ctx;
  host.append(button(k.ui.export, function () {
    ctx.run(parts.zk.exportPose);
  }, "zk-export"));
  const src = el("input", { attrs: { type: "checkbox" }, on: { change: function (e) {
    parts.pov.options({ srcCamera: e.target.checked });
  } } });
  const srcLabel = el("label", { className: "zk-field" });
  srcLabel.append(src, el("span", { text: k.ui.srcCamera }));
  const shot = field(k.ui.shot, k.ui.shotPlaceholder, function (e) {
    parts.pov.options({ names: { shot: e.target.value } });
  });
  const character = field(k.ui.character, k.ui.characterPlaceholder, function (e) {
    parts.pov.options({ names: { character: e.target.value } });
  });
  host.append(srcLabel, shot.label, character.label);
  host.append(...rangeParts(ctx, parts));

  function update() {
    src.checked = state.pov.srcCamera;
    setValue(shot.input, state.pov.names.shot);
    setValue(character.input, state.pov.names.character);
  }
  bus.on(EVENTS.pov, update);
  update();
}
