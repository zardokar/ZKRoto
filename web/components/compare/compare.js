// COMPONENT compare: before / after of the answers Claude wrote (wf_zkreq_3; Koh voice 2026-11-24 16:0x). Opens over
// the stage on zk:compare; status = id, the words Koh gave, seed, n / total; one icon switch: side by side (two
// pictures) or wipe (before over after, handle left / right); back / next; Esc / X; one view moves both pictures.
import { EVENTS } from "../../js/zk_events.js";
import { el, pressed } from "../../js/zk_dom.js";
import { icon } from "../../js/zk_reqicons.js";
import { fitView, zoomAt, panBy, css, wipeKey } from "../../js/zk_compareview.js";
import { bindInput } from "./compare_input.js";

function round(x) {
  return Math.round(x * 1000) / 1000;
}

function iconButton(name, tip, onClick) {
  const btn = el("button", { className: "zk-cmp-btn", attrs: { type: "button", "data-tip": tip, "aria-label": tip },
    on: { click: onClick } });
  btn.innerHTML = icon(name);
  return btn;
}

function layer(cls) {
  const img = el("img", { className: "zk-cmp-img", attrs: { alt: "", draggable: "false" } });
  const div = el("div", { className: cls });
  div.appendChild(img);
  return { div, img };
}

export function mount(host, ctx, parts) {
  const { cfg, k, bus } = ctx;
  const tips = k.ui.reqTips;
  const lim = { min: cfg.request.zoomMin, max: cfg.request.zoomMax };
  const s = { list: [], i: 0, mode: "side", wipe: 0.5, v: { k: 1, ox: 0, oy: 0 }, box: { w: 0, h: 0 } };
  const status = el("span", { className: "zk-cmp-status mono" });
  const before = layer("zk-cmp-before");
  const after = layer("zk-cmp-after");
  const handle = el("div", { className: "zk-cmp-handle", attrs: { "data-tip": tips.wipeHandle } });
  const box = el("div", { className: "zk-cmp-box" });
  const modes = { side: iconButton("side", tips.side, () => setMode("side")),
    wipe: iconButton("wipe", tips.wipe, () => setMode("wipe")) };
  const bar = el("div", { className: "zk-cmp-bar" });
  bar.append(status, el("span", { className: "zk-cmp-gap" }), modes.side, modes.wipe,
    iconButton("back", tips.back, () => show(s.i - 1)), iconButton("next", tips.next, () => show(s.i + 1)),
    iconButton("close", tips.close, close));
  box.append(after.div, before.div, handle);
  host.append(bar, box);
  host.hidden = true;

  function paneSize() {
    return { w: s.mode === "side" ? s.box.w / 2 : s.box.w, h: s.box.h };
  }
  function apply() {
    const t = css(s.v);
    before.img.style.transform = t;
    after.img.style.transform = t;
    handle.style.left = round(s.wipe * 100) + "%";
    before.div.style.clipPath = s.mode === "wipe" ? "inset(0 " + round((1 - s.wipe) * 100) + "% 0 0)" : "none";
  }
  function measure() {
    if (typeof box.getBoundingClientRect === "function") {
      const r = box.getBoundingClientRect();
      s.box = { w: r.width, h: r.height, left: r.left, top: r.top };
    }
  }
  function fit() {
    const p = paneSize();
    if (before.img.naturalWidth && p.w) {
      s.v = fitView(before.img.naturalWidth, before.img.naturalHeight, p.w, p.h);
    }
    apply();
  }
  function setMode(mode) {
    s.mode = mode;
    host.dataset.mode = mode;
    pressed(modes.side, mode === "side");
    pressed(modes.wipe, mode === "wipe");
    measure();
    fit();
  }
  function show(i, quiet) {
    if (!s.list.length) {
      return;
    }
    s.i = Math.max(0, Math.min(s.list.length - 1, i));
    const a = s.list[s.i];
    status.textContent = ctx.t("compareStatus", { id: a.id, prompt: a.prompt || "", seed: a.seed === undefined ? "-" :
      a.seed, i: s.i + 1, n: s.list.length });
    before.img.src = a.src;
    after.img.src = a.result;
    if (!quiet) {
      parts.request.markSeen(a.key);
    }
  }
  function open(d) {
    s.list = parts.request.answers();
    const at = d.key ? s.list.findIndex((a) => a.key === d.key) : 0;
    host.hidden = false;
    setMode(s.mode);
    show(Math.max(0, at));
  }
  function close() {
    host.hidden = true;
  }
  // New answers while open: keep showing the same one, the count follows.
  bus.on(EVENTS.request, function (d) {
    if (host.hidden || d.answers === undefined || !s.list.length) {
      return;
    }
    const key = s.list[s.i].key;
    s.list = parts.request.answers();
    show(Math.max(0, s.list.findIndex((a) => a.key === key)), true);
  });
  before.img.addEventListener("load", fit);
  bus.on(EVENTS.compare, function (d) {
    if (d.open) {
      open(d);
    } else {
      close();
    }
  });
  const api = {
    isOpen: () => !host.hidden,
    mode: () => s.mode,
    pane: paneSize,
    box: () => s.box,
    measure,
    close,
    fit,
    setBox: function (w, h) {
      s.box = { w, h, left: 0, top: 0 };
    },
    zoom: function (f, x, y) {
      s.v = zoomAt(s.v, f, x, y, lim);
      apply();
    },
    pan: function (dx, dy) {
      s.v = panBy(s.v, dx, dy);
      apply();
    },
    setWipe: function (w) {
      s.wipe = w;
      apply();
    },
    key: function (code) {
      s.wipe = wipeKey(s.wipe, code, cfg.request.wipeStep);
      apply();
    },
  };
  setMode("side");
  bindInput({ box, handle, cfg, api });
  return api;
}
