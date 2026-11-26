// LOGICAL (pure): the Fill / Stroke box of Koh's canvas module (cv_color.js, cv_style.js, cv_data.js cvColorOf,
// cv_cmdmake.js cvMakeSwap; docs/cv_color.js.md, docs/cv_style.js.md). style = { fill, stroke, front, fillOp,
// strokeOp }; colours are "#rrggbb" or "none". No history yet (undo = plan_rev3 Next 3).
import { hexOk } from "./zk_hsv.js";
import { findPath } from "./zk_pendoc.js";

export const NONE = "none";
const OP_KEY = { fill: "fill_opacity", stroke: "stroke_opacity" };

export function newStyle(look) {
  return { fill: look.fill, stroke: look.stroke, front: "fill", fillOp: 1, strokeOp: 1 };
}

export function colorOf(style) {
  return style.front === "stroke" ? style.stroke : style.fill;
}

export function opacityOf(style) {
  return style.front === "stroke" ? style.strokeOp : style.fillOp;
}

export function setFront(style, which) {
  style.front = which === "stroke" ? "stroke" : "fill";
  return style.front;
}

// Koh 2026-11-24 14:21 "เวลาสร้าง vector เส้น stroke ให้ default None": a new shape takes the box stroke as it is,
// None included (replaces canvas rule 24); the line being drawn is still shown as a sketch (zk_pendraw.js).
function newStroke(style) {
  return style.stroke || NONE;
}

export function shapeStyle(style, look) {
  const out = { fill: style.fill || NONE, stroke: newStroke(style), stroke_width: look.strokeWidth };
  if (style.fillOp !== 1) {
    out.fill_opacity = style.fillOp;
  }
  if (style.strokeOp !== 1) {
    out.stroke_opacity = style.strokeOp;
  }
  return out;
}

// cvColorApply: the front square always; the chosen shape too. A fill closes the shape (cvSetFill, #140).
export function applyColor(style, doc, id, value) {
  const hex = value === NONE ? NONE : String(value || "").toLowerCase();
  if (hex !== NONE && !hexOk(hex)) {
    return false;
  }
  style[style.front] = hex;
  const path = id ? findPath(doc, id) : null;
  if (path) {
    path[style.front] = hex;
    if (style.front === "fill" && hex !== NONE) {
      path.closed = true;
    }
  }
  return true;
}

// cvMakeSwap: read both before writing either (else both squares end with one colour).
export function swap(style, doc, id) {
  const box = [style.fill, style.stroke, style.fillOp, style.strokeOp];
  [style.stroke, style.fill, style.strokeOp, style.fillOp] = box;
  const path = id ? findPath(doc, id) : null;
  if (path) {
    const was = [path.fill, path.stroke, path.fill_opacity, path.stroke_opacity];
    path.fill = was[1];
    path.stroke = was[0];
    writeOpacity(path, "fill", was[3]);
    writeOpacity(path, "stroke", was[2]);
  }
  return true;
}

function clamp(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

// Full opacity = no key on the shape (cvSetOpacity), so untouched work stays byte-equal.
function writeOpacity(path, which, value) {
  if (value === undefined || value === null || value === 1) {
    delete path[OP_KEY[which]];
  } else {
    path[OP_KEY[which]] = value;
  }
}

export function setOpacity(style, doc, id, value) {
  const op = clamp(value);
  style[style.front === "stroke" ? "strokeOp" : "fillOp"] = op;
  const path = id ? findPath(doc, id) : null;
  if (path) {
    writeOpacity(path, style.front, op);
  }
  return op;
}

// cvColorFromSel: choosing a shape shows its colours in the box.
export function fromPath(style, path) {
  if (!path) {
    return false;
  }
  style.fill = path.fill || NONE;
  style.stroke = path.stroke || NONE;
  style.fillOp = path.fill_opacity === undefined ? 1 : clamp(path.fill_opacity);
  style.strokeOp = path.stroke_opacity === undefined ? 1 : clamp(path.stroke_opacity);
  return true;
}
