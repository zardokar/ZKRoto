// LOGICAL: what one request to Claude holds (Koh 2026-11-24 15:37 - 16:24; design ZComfy .dropzone/lab/20261124_zkreq/).
// The mask is every shape you can see, white on black at picture size (fill area, stroke at its width); the server
// writes it with the shown picture, the shapes as SVG and req.json into input/ZKRoto/req/<id>/ (zk_request.py).
import { trace } from "./zk_pendraw.js";

const BLACK = "#000000";
const WHITE = "#ffffff";

function two(n) {
  return String(n).padStart(2, "0");
}

export function requestId(date) {
  const d = date || new Date();
  return "req_" + d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + "_" + two(d.getHours()) +
    two(d.getMinutes()) + two(d.getSeconds());
}

// A layer counts when it has a colour and is not fully transparent (as the pen draws it).
function shown(colour, opacity) {
  return !!colour && colour !== "none" && opacity !== 0;
}

// Returns how many shapes went into the mask. Strokes go in at full width, as the canvas draws them (the SVG
// writes a tapered open line as its body polygon instead).
export function drawMask(g, doc, width, height) {
  g.fillStyle = BLACK;
  g.fillRect(0, 0, width, height);
  g.lineJoin = "round";
  g.lineCap = "round";
  let n = 0;
  for (const path of doc.paths) {
    const fill = shown(path.fill, path.fill_opacity);
    const stroke = shown(path.stroke, path.stroke_opacity);
    if (path.visible === false || (path.points || []).length < 2 || (!fill && !stroke)) {
      continue;
    }
    n += 1;
    if (fill) {
      g.fillStyle = WHITE;
      trace(g, path);
      g.fill();
    }
    if (stroke) {
      g.strokeStyle = WHITE;
      g.lineWidth = path.stroke_width || 1;
      trace(g, path);
      g.stroke();
    }
  }
  return n;
}

function bare(dataUrl) {
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

export function requestBody(o) {
  return { id: o.id, mask: bare(o.mask), src: bare(o.src), svg: o.svg, req: { picture: o.info.name,
    width: o.info.width, height: o.info.height, frame: o.info.frame, shapes: o.shapes, time: o.time } };
}

function viewUrl(subfolder, file) {
  return "/view?filename=" + encodeURIComponent(file) + "&type=input&subfolder=" + encodeURIComponent(subfolder);
}

// Every answer of every request, newest request first (the server list order), answers in their order.
export function flatAnswers(list) {
  const out = [];
  for (const r of list) {
    for (const a of r.answers) {
      out.push(Object.assign({}, a, { key: r.id + ":" + a.n, id: r.id, req: r.req,
        src: viewUrl(r.subfolder, "src.png"), result: viewUrl(r.subfolder, a.file) }));
    }
  }
  return out;
}

export function unseen(flat, seen) {
  return flat.filter((a) => !seen.has(a.key)).length;
}
