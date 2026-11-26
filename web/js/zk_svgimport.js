// LOGICAL (pure): an .svg file -> pen path specs at picture size (Koh 2026-11-25: import the marking back onto the base
// picture). <path> inside <svg> / <g> with transforms; viewBox scaled to the picture; fill / stroke from attributes or
// style; SVG defaults (fill black, stroke none). Arcs and hidden paths are left out. Rules: docs/zk_api.js.md.
import { parseD } from "./zk_svgpathd.js";
import { colour, opacityOf } from "./zk_svgcolour.js";

export { colour };

const TAG = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const ATTR = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const SAME = 1e-6;
const NOT_DRAWN = new Set(["defs", "clippath", "mask", "symbol", "marker", "pattern"]);
const INHERITED = ["fill", "stroke", "stroke-width", "fill-opacity", "stroke-opacity"];
const NUM = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

function attrs(text) {
  const out = {};
  for (const m of text.matchAll(ATTR)) {
    out[m[1]] = m[2] !== undefined ? m[2] : m[3];
  }
  for (const part of String(out.style || "").split(";")) {
    const at = part.indexOf(":");
    if (at > 0) {
      out[part.slice(0, at).trim()] = part.slice(at + 1).trim();
    }
  }
  return out;
}

function mul(a, b) {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

function oneTransform(name, v) {
  if (name === "translate") {
    return [1, 0, 0, 1, v[0] || 0, v[1] || 0];
  }
  if (name === "scale") {
    return [v[0], 0, 0, v.length > 1 ? v[1] : v[0], 0, 0];
  }
  if (name === "rotate") {
    const r = (v[0] || 0) * Math.PI / 180;
    const rot = [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
    const cx = v[1] || 0;
    const cy = v[2] || 0;
    return mul(mul([1, 0, 0, 1, cx, cy], rot), [1, 0, 0, 1, -cx, -cy]);
  }
  if (name === "skewX" || name === "skewY") {
    const k = Math.tan((v[0] || 0) * Math.PI / 180);
    return name === "skewX" ? [1, 0, k, 1, 0, 0] : [1, k, 0, 1, 0, 0];
  }
  return name === "matrix" && v.length === 6 ? v : [1, 0, 0, 1, 0, 0];
}

// No numbers, or numbers that are not finite: no transform (never NaN points).
function safeTransform(name, v) {
  if (name !== "translate" && name !== "rotate" && !v.length) {
    return [1, 0, 0, 1, 0, 0];
  }
  const m = oneTransform(name, v);
  return m.every(Number.isFinite) ? m : [1, 0, 0, 1, 0, 0];
}

export function parseTransform(text) {
  let m = [1, 0, 0, 1, 0, 0];
  for (const t of String(text || "").matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = (t[2].match(NUM) || []).map(Number);
    m = mul(m, safeTransform(t[1], v));
  }
  return m;
}

function apply(m, x, y) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

function placePoint(m, p) {
  const out = apply(m, p.x, p.y);
  if (p.cx1 !== undefined) {
    const a = apply(m, p.cx1, p.cy1);
    const b = apply(m, p.cx2, p.cy2);
    Object.assign(out, { cx1: a.x, cy1: a.y, cx2: b.x, cy2: b.y });
  }
  return out;
}

// A closed subpath that comes back to its start: drop the copy, its curve handles go to the first point (pen rule).
function tidy(sub) {
  const pts = sub.points;
  const last = pts[pts.length - 1];
  if (sub.closed && pts.length > 2 && Math.abs(last.x - pts[0].x) < SAME && Math.abs(last.y - pts[0].y) < SAME) {
    pts.pop();
    if (last.cx1 !== undefined) {
      Object.assign(pts[0], { cx1: last.cx1, cy1: last.cy1, cx2: last.cx2, cy2: last.cy2 });
    }
  }
  return sub;
}

function rounded(v) {
  return Math.round(v * 1000) / 1000;
}

function roundPoint(p) {
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    out[k] = rounded(v);
  }
  return out;
}

function specs(a, m, scale) {
  const parsed = parseD(a.d);
  if (parsed.arc) {
    return null;
  }
  const width = Number(a["stroke-width"]);
  const look = { fill: colour(a.fill, "#000000"), stroke: colour(a.stroke, "none"),
    stroke_width: rounded((Number.isFinite(width) && width >= 0 ? width : 1) * scale) };
  for (const name of ["fill-opacity", "stroke-opacity"]) {
    const v = opacityOf(a, name);
    if (v !== undefined) {
      look[name.replace("-", "_")] = v;
    }
  }
  const finite = (s) => s.points.every((p) => Object.values(p).every(Number.isFinite));
  return parsed.subpaths.filter((s) => s.points.length > 1 && finite(s)).map((s) => Object.assign({
    kind: s.curved ? "bezier" : "poly", closed: s.closed,
    points: tidy(s).points.map((p) => roundPoint(placePoint(m, p))) }, look));
}

function rootMatrix(a, size) {
  const vb = String(a.viewBox || "").trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    return [size.width / vb[2], 0, 0, size.height / vb[3], -vb[0] * size.width / vb[2], -vb[1] * size.height / vb[3]];
  }
  return [1, 0, 0, 1, 0, 0];
}

// maxShapes (config ai.importMaxShapes): a file with more shapes is refused before the pen sees it (review 2).
export function importSvg(text, size, maxShapes) {
  const most = maxShapes || Infinity;
  const src = String(text || "").replace(/<!--[\s\S]*?-->/g, "");
  if (!/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/.test(src) || src.includes("<!")) {
    throw new Error("not an SVG");
  }
  const stack = [];
  const out = { paths: [], skipped: 0 };
  for (const t of src.matchAll(TAG)) {
    const name = t[2].toLowerCase();
    if (t[1]) {
      stack.pop();
      continue;
    }
    const parent = stack.length ? stack[stack.length - 1] : { m: [1, 0, 0, 1, 0, 0], hidden: false, look: {} };
    const a = Object.assign({}, parent.look, attrs(t[3]));
    const m = mul(name === "svg" && !stack.length ? rootMatrix(a, size) : parent.m, parseTransform(a.transform));
    const hidden = parent.hidden || a.display === "none" || a.visibility === "hidden" || NOT_DRAWN.has(name);
    if (name === "path" && !hidden) {
      const got = specs(a, m, Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])));
      if (got === null) {
        out.skipped += 1;
      } else if (out.paths.length + got.length > most) {
        throw new Error("too many shapes (over " + most + ")");
      } else {
        for (const one of got) {
          out.paths.push(one);
        }
      }
    }
    if (!t[4]) {
      stack.push({ m, hidden, look: Object.fromEntries(INHERITED.filter((k) => a[k] !== undefined).map((k) => [k, a[k]])) });
    }
  }
  return out;
}
