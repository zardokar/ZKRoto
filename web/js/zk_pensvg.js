// LOGICAL (pure): pen doc -> SVG text. Ported from Koh's canvas module (cv_render.js cvPathTag): one <path> per
// path, round joins and caps. ZKRoto addition: an OPEN path with taper [root, tip] is written as its tapered
// body (zk_penbody.js), so a hair strand ends in a point, not a blunt bar (Koh 2026-11-24).
import { pathD, flattenPath, num } from "./zk_penpath.js";
import { bodyPolygon } from "./zk_penbody.js";

const BODY_STEP = 2;

export function attrEsc(text) {
  return String(text === undefined || text === null ? "" : text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Opacity is written only when not full (canvas cv_render.js cvOpAttr): untouched files stay byte for byte.
function opAttr(value, name) {
  if (value === undefined || value === 1) {
    return "";
  }
  return '" ' + name + '-opacity="' + Number(value);
}

function tapered(path) {
  return !path.closed && Array.isArray(path.taper) && (path.taper[0] > 0 || path.taper[1] > 0);
}

// The width profile needs samples along the line, so straight segments are split every BODY_STEP doc units.
function densify(points) {
  const out = [[points[0].x, points[0].y]];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / BODY_STEP));
    for (let k = 1; k <= n; k += 1) {
      out.push([a.x + (b.x - a.x) * k / n, a.y + (b.y - a.y) * k / n]);
    }
  }
  return out;
}

function bodyTag(path) {
  const centre = densify(flattenPath(path));
  const body = bodyPolygon(centre, { width: path.stroke_width || 1, taper: path.taper });
  const d = body.map((q, i) => (i ? "L" : "M") + num(q[0]) + " " + num(q[1])).join(" ") + " Z";
  return '<path id="p_' + attrEsc(path.id) + '" d="' + d + '" fill="' + attrEsc(path.stroke || "none") +
    opAttr(path.stroke_opacity, "fill") + '"/>';
}

export function pathTag(path) {
  const d = pathD(path);
  if (!d) {
    return "";
  }
  if (tapered(path)) {
    return bodyTag(path);
  }
  const stroke = path.stroke && path.stroke !== "none" ? path.stroke : "none";
  return '<path id="p_' + attrEsc(path.id) + '" d="' + d + '" fill="' + attrEsc(path.fill || "none") +
    opAttr(path.fill_opacity, "fill") + '" stroke="' + attrEsc(stroke) + opAttr(path.stroke_opacity, "stroke") +
    '" stroke-width="' + (path.stroke_width || 1) +
    '" stroke-linejoin="round" stroke-linecap="round"/>';
}

export function toSvg(doc, width, height) {
  const out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
    '" viewBox="0 0 ' + width + " " + height + '">'];
  for (const path of doc.paths) {
    const tag = path.visible === false ? "" : pathTag(path);
    if (tag) {
      out.push(tag);
    }
  }
  out.push("</svg>");
  return out.join("\n");
}
