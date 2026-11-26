// COMPONENT apibar: header row 1, flush right (wf_zkapi_3, Koh OK 2026-11-25 21:21): model list | refresh | gap |
// key, on the same columns as row 2 (import export | send | compare), ui_policy D1. Key panel and error box drop
// under the bar. Talks only to parts.models, parts.ai and the bus.
import { EVENTS } from "../../js/zk_events.js";
import { el } from "../../js/zk_dom.js";
import { icon, ring } from "../../js/zk_reqicons.js";
import { makeKeyPanel } from "./apibar_key.js";
import { makeErrBox } from "./apibar_err.js";

function iconButton(name, tip, onClick) {
  const b = el("button", { className: "zk-req-btn", attrs: { type: "button", "data-tip": tip, "aria-label": tip },
    on: { click: onClick } });
  b.innerHTML = icon(name);
  return b;
}

function makeList(ctx, parts, onPick) {
  const list = el("div", { className: "zk-api-list zk-api-pop", attrs: { role: "listbox", tabindex: "-1" } });
  let items = [];
  let at = 0;

  function render(state) {
    list.replaceChildren();
    items = state.models.map(function (m, i) {
      const chosen = m.id === state.chosen;
      if (i > 0 && m.group === "old" && state.models[i - 1].group !== "old") {
        list.appendChild(el("div", { className: "zk-api-sep", attrs: { role: "separator" } }));
      }
      const item = el("div", { className: "zk-api-item", text: m.name, attrs: { role: "option",
        "aria-selected": String(chosen), "data-id": m.id }, on: { click: function () {
        onPick(m.id);
      } } });
      list.appendChild(item);
      return item;
    });
    at = Math.max(0, state.models.findIndex((m) => m.id === state.chosen));
    const when = state.checked ? ctx.t("aiChecked", { time: state.checked }) : ctx.k.ui.api.noModels;
    list.appendChild(el("div", { className: "zk-api-checked", text: when }));
  }

  function move(step) {
    if (!items.length) {
      return;
    }
    at = (at + step + items.length) % items.length;
    items.forEach((item, i) => item.classList.toggle("zk-api-at", i === at));
  }

  list.addEventListener("keydown", function (e) {
    const keys = { ArrowDown: 1, ArrowUp: -1 };
    if (e.key in keys) {
      e.preventDefault();
      move(keys[e.key]);
    } else if (e.key === "Enter" && items[at]) {
      onPick(items[at].getAttribute("data-id"));
    } else if (e.key === "Escape") {
      list.hidden = true;
    }
  });
  list.hidden = true;
  return { list, render };
}

export function mount(host, ctx, parts) {
  const tips = ctx.k.ui.apiTips;
  let state = { hasKey: false, loading: false, models: [], chosen: "", checked: "" };
  const keyPanel = makeKeyPanel(ctx, parts);
  const errBox = makeErrBox(ctx, { openKey: function () {
    keyPanel.open("key");
  }, retry: function (info) {
    return info && info.from === "models" ? parts.models.refresh(true) : parts.ai.retry();
  } });
  const picker = makeList(ctx, parts, function (id) {
    picker.list.hidden = true;
    parts.models.choose(id);
  });
  const name = el("span", { className: "zk-api-name" });
  const chevron = el("span", { className: "zk-api-chevron" });
  chevron.innerHTML = icon("down");
  const model = el("button", { className: "zk-api-model", attrs: { type: "button", "aria-haspopup": "listbox",
    "data-tip": tips.model }, on: { click: function () {
    if (!state.hasKey) {
      keyPanel.open("key");
      return;
    }
    picker.list.hidden = !picker.list.hidden;
    if (!picker.list.hidden && picker.list.focus) {
      picker.list.focus();
    }
  } } });
  model.append(name, chevron);
  const refresh = iconButton("refresh", tips.refresh, function () {
    return parts.models.refresh(true);
  });
  const spin = el("span", { className: "zk-req-ring" });
  spin.innerHTML = ring();
  refresh.appendChild(spin);
  const gap = el("span", { className: "zk-req-divider zk-api-gap", attrs: { "aria-hidden": "true" } });
  const dot = el("span", { className: "zk-api-keydot" });
  const key = iconButton("key", tips.key, function () {
    if (keyPanel.node.hidden) {
      keyPanel.open("key");
    } else {
      keyPanel.close();
    }
  });
  key.appendChild(dot);
  host.append(model, picker.list, refresh, gap, key, keyPanel.node, errBox.node);

  ctx.bus.on(EVENTS.models, function (s) {
    state = s;
    const chosen = s.models.find((m) => m.id === s.chosen);
    name.textContent = s.hasKey ? (chosen ? chosen.name : s.chosen || ctx.k.ui.api.noModels) : ctx.k.ui.api.noKey;
    model.setAttribute("data-tip", chosen ? chosen.name : tips.model);
    model.classList.toggle("zk-dim", !s.hasKey);
    refresh.classList.toggle("zk-dim", !s.hasKey);
    refresh.classList.toggle("zk-busy", !!s.loading);
    dot.hidden = !s.hasKey;
    picker.render(s);
  });
  ctx.bus.on(EVENTS.needKey, function () {
    keyPanel.open("nokey");
  });
  ctx.bus.on(EVENTS.aiErr, errBox.show);
  dot.hidden = true;
  parts.models.refresh(false).catch(function () {
    return null;
  });
}
