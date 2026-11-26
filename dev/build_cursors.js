// Koh's canvas cursors (dev/cursors_canvas.json = canvas module constants/cursors.json, unchanged) made smaller
// and thinner (Koh 2026-11-24 13:47: "ปัญหามันแค่ cursor มันใหญ่ และหนาไป"): same drawings, drawn at SIZE px
// with a thinner dark edge, hot spots scaled. USAGE: node dev/build_cursors.js [--check]
"use strict";
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "cursors_canvas.json");
const OUT = path.join(__dirname, "..", "web", "constants", "cursors.json");
const FROM_PX = 24;
const SIZE = 16;
const EDGE_SCALE = 0.9;
const INK_SCALE = 0.75;
// Drawings that touch their own edge are cut when drawn small (Koh 14:19: the zoom cursor looked strange): a margin.
const PAD = { zoom: 0.12, zoom_in: 0.12, zoom_out: 0.12 };

// The dark edge width is written once per drawing ("stroke-width" of the first <g>); the ink keeps its own widths.
function thinner(svg) {
  let out = svg.replace(`width="${FROM_PX}" height="${FROM_PX}"`, `width="${SIZE}" height="${SIZE}"`);
  out = out.replace(/(<g fill="#000000" stroke="#000000" stroke-width=")([\d.]+)"/, function (m, head, w) {
    return head + Math.round(Number(w) * EDGE_SCALE * 1000) / 1000 + '"';
  });
  return out.replace(/(<g fill="#ffffff" stroke="#ffffff">)([\s\S]*)(<\/g><\/svg>)$/, function (m, open, body, close) {
    const ink = body.replace(/stroke-width="([\d.]+)"/g, function (s, w) {
      return `stroke-width="${Math.round(Number(w) * INK_SCALE * 1000) / 1000}"`;
    });
    return open + ink + close;
  });
}

function padded(svg, name, c) {
  const pad = PAD[name] || 0;
  const box = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const m = box[2] * pad;
  const out = svg.replace(/viewBox="[^"]+"/, `viewBox="${box[0] - m} ${box[1] - m} ${box[2] + 2 * m} ${box[3] + 2 * m}"`);
  const spot = (h) => Math.round(((h / FROM_PX) * box[2] + m) / (box[2] + 2 * m) * SIZE);
  return { svg: out, hx: spot(c.hx), hy: spot(c.hy) };
}

function build() {
  const src = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const out = {};
  for (const [name, c] of Object.entries(src)) {
    const svg = decodeURIComponent(c.uri.replace("data:image/svg+xml,", ""));
    const p = padded(thinner(svg), name, c);
    out[name] = { uri: "data:image/svg+xml," + encodeURIComponent(p.svg), hx: p.hx, hy: p.hy };
  }
  return JSON.stringify(out, null, 2) + "\n";
}

function main() {
  const text = build();
  if (process.argv.includes("--check")) {
    const same = fs.existsSync(OUT) && fs.readFileSync(OUT, "utf8") === text;
    console.log(same ? "cursors.json: in step" : "cursors.json: differs from dev/build_cursors.js");
    process.exitCode = same ? 0 : 1;
    return;
  }
  fs.writeFileSync(OUT, text);
  console.log("wrote " + OUT);
}

module.exports = { build, SIZE, FROM_PX };
if (require.main === module) {
  main();
}
