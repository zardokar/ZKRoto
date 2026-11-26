// COMPONENT exportbar (Roto panel, Export tab; wf_modes round 1, Koh OK 2026-11-26 17:54): label | value rows for
// shot, character, source camera (themed switch, z-ui Never: a browser checkbox) and frames from / to (empty = whole
// clip), then Export range | Export, 50:50 with the main action right (z-ui B1). Export range turns into Stop.
import { EVENTS } from "../../js/zk_events.js";
import { el, button, setValue } from "../../js/zk_dom.js";

function row(host, labelText, ...value) {
  host.append(el("span", { className: "zk-exp-label", text: labelText }), ...value);
}

function input(placeholder, aria, onInput) {
  return el("input", { className: "zk-name", attrs: { placeholder, "aria-label": aria }, on: onInput ? { input: onInput } : {} });
}

function rangeButton(ctx, parts, from, to) {
  const { k } = ctx;
  let running = false;
  const btn = button(k.ui.exportRange, async function () {
    if (running) {
      parts.zk.stopRange();
      return;
    }
    running = true;
    btn.textContent = k.ui.stopRange;
    await ctx.run(parts.zk.exportRange, { from: from.value.trim(), to: to.value.trim() });
    running = false;
    btn.textContent = k.ui.exportRange;
  }, "zk-export-range");
  return btn;
}

export function mount(host, ctx, parts) {
  const { k, bus, state } = ctx;
  const shot = input(k.ui.shotPlaceholder, k.ui.shot, function (e) {
    parts.pov.options({ names: { shot: e.target.value } });
  });
  const character = input(k.ui.characterPlaceholder, k.ui.character, function (e) {
    parts.pov.options({ names: { character: e.target.value } });
  });
  const src = el("button", { className: "zk-switch", attrs: { type: "button", role: "switch", "aria-label": k.ui.srcCamera },
    on: { click: function () {
      parts.pov.options({ srcCamera: !state.pov.srcCamera });
    } } });
  const from = input(k.ui.rangeAll, k.ui.rangeFrom);
  const to = input(k.ui.rangeAll, k.ui.rangeTo);
  const pair = el("div", { className: "zk-exp-pair" });
  pair.append(from, to);
  const acts = el("div", { className: "zk-exp-acts" });
  acts.append(rangeButton(ctx, parts, from, to), button(k.ui.export, function () {
    ctx.run(parts.zk.exportPose);
  }, "zk-export"));
  row(host, k.ui.shot, shot);
  row(host, k.ui.character, character);
  row(host, k.ui.srcCamera, src);
  row(host, k.ui.frames, pair);
  host.append(acts);
  function update() {
    src.setAttribute("aria-checked", String(!!state.pov.srcCamera));
    setValue(shot, state.pov.names.shot);
    setValue(character, state.pov.names.character);
  }
  bus.on(EVENTS.pov, update);
  update();
}
