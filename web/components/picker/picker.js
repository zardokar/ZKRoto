// COMPONENT picker: the canvas module's colour box (canvas.html #cvPicker, cv_picker.js, cv_pickview.js): hue ring +
// S/V triangle (zk_wheel.js), opacity, hex field, eyedropper. Opened through the bus (zk:picker) by the Fill /
// Stroke box; a click outside or the close button closes it. Every pick goes live to parts.pen.color.
import { EVENTS } from "../../js/zk_events.js";
import { el } from "../../js/zk_dom.js";
import { ICONS } from "../../js/zk_penicons.js";
import { hexOk, hexToHsv, hsvToHex } from "../../js/zk_hsv.js";
import * as W from "../../js/zk_wheel.js";
import { buildWheel } from "./picker_wheel.js";

const CLOSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12 M18 6L6 18"></path></svg>';

function head(t, onEye, onClose) {
  const title = el("span", { className: "zk-picktitle" });
  const eye = el("button", { className: "zk-pickbtn", attrs: { type: "button", "data-tip": t.eye, "aria-label": t.eye },
    on: { click: onEye } });
  eye.innerHTML = `<img class="zk-pickico" src="${ICONS.eyedrop.uri}" alt="">`;
  const close = el("button", { className: "zk-pickbtn", attrs: { type: "button", "data-tip": t.close,
    "aria-label": t.close }, on: { click: onClose } });
  close.innerHTML = CLOSE_SVG;
  const row = el("div", { className: "zk-pickhead" });
  row.append(title, eye, close);
  return { row, title, eye };
}

function foot(t) {
  const opRow = el("div", { className: "zk-oprow" });
  const opacity = el("input", { attrs: { type: "range", min: 0, max: 100, value: 100, "aria-label": t.opacity } });
  const opText = el("span", { className: "zk-opval mono" });
  opRow.append(el("span", { text: t.opacity }), opacity, opText);
  const hexRow = el("div", { className: "zk-pickfoot" });
  const now = el("span", { className: "zk-nowbox" });
  const hex = el("input", { className: "mono", attrs: { type: "text", maxlength: 7, spellcheck: "false" } });
  const label = el("label", { className: "zk-hexwrap", text: "#" });
  label.append(hex);
  hexRow.append(now, label);
  return { opRow, opacity, opText, hexRow, now, hex };
}

export function mount(host, ctx, parts) {
  const { k, bus } = ctx;
  const t = k.ui.color;
  const color = parts.pen.color;
  const hsv = { h: 0, s: 1, v: 1 };
  // Opens beside the colour box it belongs to (the box sits under the tools since wf_modes round 1), top-aligned.
  function show(on) {
    host.hidden = !on;
    if (on) {
      const box = host.parentElement && host.parentElement.querySelector('[data-component="colorbox"]');
      if (box && box.offsetParent) {
        host.style.top = box.offsetTop + "px";
        host.style.bottom = "auto";
      }
      load();
    }
  }
  const top = head(t, function () {
    parts.pen.tool("eyedrop");
    show(false);
  }, function () {
    show(false);
  });
  const hsvText = el("span", { className: "zk-hsv mono" });
  const wheel = buildWheel();
  const low = foot(t);
  host.append(top.row, hsvText, wheel.wrap, low.opRow, low.hexRow);

  // Grey and black have no hue (s or v = 0): keep the triangle where it was (no jump).
  function keepHue(next) {
    if (next) {
      hsv.h = next.s === 0 || next.v === 0 ? hsv.h : next.h;
      hsv.s = next.s;
      hsv.v = next.v;
    }
  }
  function paint() {
    const hex = hsvToHex(hsv);
    wheel.paint(hsv, hex);
    hsvText.textContent = `H ${Math.round(hsv.h)} · S ${Math.round(hsv.s * 100)} · V ${Math.round(hsv.v * 100)}`;
    low.now.style.backgroundColor = hex;
    return hex;
  }
  function load() {
    const s = color.style();
    const front = s.front === "stroke" ? s.stroke : s.fill;
    keepHue(hexToHsv(front));
    top.title.textContent = s.front === "stroke" ? t.pickStroke : t.pickFill;
    const op = Math.round((s.front === "stroke" ? s.strokeOp : s.fillOp) * 100);
    low.opacity.value = String(op);
    low.opText.textContent = op + "%";
    low.hex.value = hexOk(front) ? front.slice(1) : "";
    low.hex.classList.toggle("zk-bad", false);
    paint();
  }
  // One position of the wheel (viewBox units): the ring sets the hue, the triangle S and V (cvPickMove).
  function pickAt(p, target) {
    const use = target || W.wheelTarget(p, hsv.h, hsv.s, hsv.v);
    if (use === "ring") {
      hsv.h = W.wheelAngle(p);
    } else {
      Object.assign(hsv, W.triToSv(p, hsv.h));
    }
    const hex = paint();
    low.hex.value = hex.slice(1);
    color.apply(hex);
    return use;
  }
  function hexEnter() {
    const text = String(low.hex.value || "").trim();
    const full = (text.charAt(0) === "#" ? text : "#" + text).toLowerCase();
    if (!hexOk(full)) {
      low.hex.classList.toggle("zk-bad", true);
      return false;
    }
    keepHue(hexToHsv(full));
    paint();
    return color.apply(full);
  }
  low.hex.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      hexEnter();
    }
  });
  low.hex.addEventListener("blur", hexEnter);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !host.hidden) {
      show(false);
    }
  });
  low.opacity.addEventListener("input", function () {
    const v = Number(low.opacity.value) / 100;
    low.opText.textContent = Math.round(v * 100) + "%";
    color.opacity(v);
  });
  wheel.bindDrag(pickAt);
  bus.on(EVENTS.picker, function (d) {
    show(!!d.open);
  });
  bus.on(EVENTS.color, function () {
    if (!host.hidden && !wheel.dragging()) {
      load();
    }
  });
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("pointerdown", function (e) {
      const inside = e.target && e.target.closest && (e.target.closest('[data-component="picker"]') ||
        e.target.closest('[data-component="colorbox"]'));
      if (!host.hidden && !inside) {
        show(false);
      }
    }, true);
  }
  show(false);
  return { parts: { title: top.title, hex: low.hex, opacity: low.opacity, eye: top.eye }, pickAt };
}
