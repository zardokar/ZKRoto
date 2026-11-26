// VIEW part of the picker: the wheel markup (canvas.html #cvWheelSvg) and its drag (cv_picker.js cvPickDown /
// cvPickMove / cvPickUp). The ring is a CSS conic gradient under an SVG with a transparent hit pad (a click on the
// ring must reach the SVG); triangle, gradients and knobs turn with the hue (cv_pickview.js cvPickPaint).
import * as W from "../../js/zk_wheel.js";
import { hsvToHex } from "../../js/zk_hsv.js";

const NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    node.setAttribute(key, String(value));
  }
  return node;
}

function gradient(id, stops) {
  const g = svgEl("linearGradient", { id, gradientUnits: "userSpaceOnUse" });
  for (const s of stops) {
    g.appendChild(svgEl("stop", s));
  }
  return g;
}

function setLine(g, from, to) {
  g.setAttribute("x1", from.x);
  g.setAttribute("y1", from.y);
  g.setAttribute("x2", to.x);
  g.setAttribute("y2", to.y);
}

export function buildWheel() {
  const wrap = document.createElement("div");
  wrap.className = "zk-wheelwrap";
  const ring = document.createElement("div");
  ring.className = "zk-ring";
  const svg = svgEl("svg", { class: "zk-wheelsvg", viewBox: `0 0 ${W.WHEEL_SIZE} ${W.WHEEL_SIZE}` });
  const hueStop = svgEl("stop", { offset: 1, "stop-color": "#ff0000" });
  const base = gradient("zkGradBase", [{ offset: 0, "stop-color": "#ffffff" }]);
  base.appendChild(hueStop);
  const dark = gradient("zkGradDark", [{ offset: 0, "stop-color": "#000000", "stop-opacity": 1 },
    { offset: 1, "stop-color": "#000000", "stop-opacity": 0 }]);
  const defs = svgEl("defs");
  defs.append(base, dark);
  const triBase = svgEl("polygon", { fill: "url(#zkGradBase)" });
  const triDark = svgEl("polygon", { fill: "url(#zkGradDark)" });
  const knobs = ["zk-knob", "zk-knob-in", "zk-knob", "zk-knob-in"].map((c) => svgEl("circle", { class: c, r: 9 }));
  svg.append(defs, svgEl("circle", { class: "zk-hitpad", cx: 100, cy: 100, r: 100, fill: "transparent" }),
    triBase, triDark, ...knobs);
  wrap.append(ring, svg);
  let target = null;

  function paint(hsv) {
    const pts = W.triPoints(hsv.h);
    const v = W.triVerts(hsv.h);
    const shade = W.triShade(hsv.h);
    triBase.setAttribute("points", pts);
    triDark.setAttribute("points", pts);
    setLine(base, v.b, v.a);
    setLine(dark, shade.from, shade.to);
    hueStop.setAttribute("stop-color", hsvToHex({ h: hsv.h, s: 1, v: 1 }));
    const knobRing = W.wheelPoint(hsv.h, (W.RING_OUT + W.RING_IN) / 2);
    const knobTri = W.svToTri(hsv.s, hsv.v, hsv.h);
    [knobRing, knobRing, knobTri, knobTri].forEach(function (p, i) {
      knobs[i].setAttribute("cx", p.x);
      knobs[i].setAttribute("cy", p.y);
    });
  }
  // viewBox units: the SVG is scaled to its box, so convert from the screen first (cvPickAt).
  function at(e) {
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W.WHEEL_SIZE, y: ((e.clientY - r.top) / r.height) * W.WHEEL_SIZE };
  }
  // preventDefault first: else the browser starts its own drag and cancels ours after one step (canvas bug).
  function bindDrag(pickAt) {
    svg.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      try {
        svg.setPointerCapture(e.pointerId);
      } catch (err) {
        target = null;
      }
      target = pickAt(at(e));
    });
    svg.addEventListener("pointermove", function (e) {
      if (target && e.buttons === 0) {
        target = null;
      } else if (target) {
        pickAt(at(e), target);
      }
    });
    for (const name of ["pointerup", "pointercancel"]) {
      svg.addEventListener(name, function () {
        target = null;
      });
    }
  }
  return { wrap, paint, bindDrag, dragging: function () {
    return target !== null;
  } };
}
