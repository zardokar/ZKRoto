// COMPONENT fpsbox: the frame rate as a themed list in the frame bar (z-ui Never: a browser <select>); the hidden #fps
// select stays the model. The list opens upward, marks the rate in use, follows zk:fps, and closes on a pick, a second
// press, Esc, a press outside (ui_policy L5), a mode switch or a new file.
import { el } from "../../js/zk_dom.js";
import { icon } from "../../js/zk_reqicons.js";
import { EVENTS } from "../../js/zk_events.js";

export function mount(host, ctx) {
  const { cfg, k } = ctx;
  const sel = ctx.el.fps;
  const value = el("span", { className: "zk-fps-value" });
  const chevron = el("span", { className: "zk-fps-chevron" });
  chevron.innerHTML = icon("down");
  const btn = el("button", { className: "zk-fps-btn mono", attrs: { type: "button", "aria-haspopup": "listbox",
    "aria-expanded": "false", "data-tip": k.ui.fpsTip, "aria-label": k.ui.fpsTip } });
  btn.append(value, chevron);
  const list = el("div", { className: "zk-fps-list", attrs: { role: "listbox" } });
  const items = [];
  function open(on) {
    list.hidden = !on;
    btn.setAttribute("aria-expanded", String(on));
  }
  function label() {
    const now = sel.value || cfg.defaultFps;
    const hit = cfg.fpsOptions.find((o) => o.value === now);
    value.textContent = hit ? hit.label : now;
    items.forEach(function (it) {
      it.node.setAttribute("aria-selected", String(it.value === now));
    });
  }
  for (const o of cfg.fpsOptions) {
    const node = el("button", { className: "zk-fps-item mono", text: o.label, attrs: { type: "button", role: "option" },
      on: { click: function () {
        sel.value = o.value;
        sel.dispatchEvent(new Event("change"));
        open(false);
        label();
      } } });
    items.push({ node, value: o.value });
    list.append(node);
  }
  btn.onclick = function () {
    open(list.hidden);
  };
  sel.addEventListener("change", label);
  ctx.bus.on(EVENTS.fps, label); // ?fps= and zk.setFps set the rate without a change event (review 18:5x)
  ctx.bus.on(EVENTS.mode, function () {
    open(false);
  });
  ctx.bus.on(EVENTS.source, function () {
    open(false);
  });
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !list.hidden) {
        open(false);
      }
    });
    document.addEventListener("pointerdown", function (e) {
      if (!list.hidden && !(e.target && e.target.closest && e.target.closest('[data-component="fpsbox"]'))) {
        open(false);
      }
    }, true);
  }
  host.append(btn, list);
  open(false);
  label();
}
