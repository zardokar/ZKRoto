// Import shapes from an .svg file onto the picture (Koh 2026-11-25 ~20:5x "มาร์กิ้งเอาออกได้แต่เอาเข้าไม่ได้";
// wireframe wf_zkapi_3, answers 21:0x: a .svg from the PC, ADDED to the shapes already there). Pure parser tests.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const WEB = path.join(__dirname, "..", "web");

function mod(name) {
  return import(pathToFileURL(path.join(WEB, "js", name)).href);
}

const SIZE = { width: 896, height: 1152 };

test("round trip: what Export SVG writes comes back as the same paths (lines, curves, closed, opacity)", async function () {
  const { toSvg } = await mod("zk_pensvg.js");
  const { importSvg } = await mod("zk_svgimport.js");
  const doc = { paths: [
    { id: "p1", kind: "poly", closed: false, fill: "none", stroke: "#62120d", stroke_width: 3,
      points: [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 90 }] },
    { id: "p2", kind: "bezier", closed: true, fill: "#ff0000", fill_opacity: 0.5, stroke: "none", stroke_width: 1,
      points: [{ x: 100, y: 100, cx1: 90, cy1: 140, cx2: 60, cy2: 110 }, { x: 200, y: 100 },
        { x: 150, y: 200, cx1: 210, cy1: 150, cx2: 180, cy2: 200 }] },
  ] };
  const out = importSvg(toSvg(doc, SIZE.width, SIZE.height), SIZE);
  assert.strictEqual(out.skipped, 0);
  assert.strictEqual(out.paths.length, 2);
  const [a, b] = out.paths;
  assert.deepStrictEqual([a.kind, a.closed, a.fill, a.stroke, a.stroke_width], ["poly", false, "none", "#62120d", 3]);
  assert.deepStrictEqual(a.points, doc.paths[0].points);
  assert.deepStrictEqual([b.kind, b.closed, b.fill, b.fill_opacity, b.stroke], ["bezier", true, "#ff0000", 0.5, "none"]);
  assert.deepStrictEqual(b.points.map((p) => [p.x, p.y]), [[100, 100], [200, 100], [150, 200]]);
  assert.deepStrictEqual([b.points[2].cx1, b.points[2].cy1, b.points[2].cx2, b.points[2].cy2], [210, 150, 180, 200]);
  assert.deepStrictEqual([b.points[0].cx1, b.points[0].cy1, b.points[0].cx2, b.points[0].cy2], [90, 140, 60, 110],
    "the closing curve's handles land on the first point (pen rule)");
});

test("viewBox is scaled to the picture size; stroke width scales too", async function () {
  const { importSvg } = await mod("zk_svgimport.js");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 576"><path d="M0 0 L448 576" ' +
    'stroke="#000" stroke-width="2" fill="none"/></svg>';
  const out = importSvg(svg, SIZE);
  assert.deepStrictEqual(out.paths[0].points, [{ x: 0, y: 0 }, { x: 896, y: 1152 }]);
  assert.strictEqual(out.paths[0].stroke_width, 4);
  assert.strictEqual(out.paths[0].stroke, "#000000", "short hex widened");
});

test("relative commands, H / V, and group + path transforms (Inkscape style)", async function () {
  const { importSvg } = await mod("zk_svgimport.js");
  const svg = '<svg width="896" height="1152"><g transform="translate(10,20)"><g transform="scale(2)">' +
    '<path transform="translate(1 1)" d="m5 5 h10 v10 l-10 0 z" style="fill:#00ff00;stroke:none"/></g></g></svg>';
  const p = importSvg(svg, SIZE).paths[0];
  assert.strictEqual(p.closed, true);
  assert.deepStrictEqual(p.points, [{ x: 22, y: 32 }, { x: 42, y: 32 }, { x: 42, y: 52 }, { x: 22, y: 52 }]);
  assert.deepStrictEqual([p.fill, p.stroke], ["#00ff00", "none"]);
});

test("Q / S / T become cubic points; arcs are skipped and counted; one path per subpath", async function () {
  const { importSvg } = await mod("zk_svgimport.js");
  const svg = '<svg width="896" height="1152"><path d="M0 0 Q 30 30 60 0 T 120 0 M200 200 C 210 210 220 210 230 200 ' +
    'S 250 190 260 200" stroke="red" fill="none"/><path d="M0 0 A 10 10 0 0 1 20 0" stroke="#111111"/></svg>';
  const out = importSvg(svg, SIZE);
  assert.strictEqual(out.paths.length, 2, "two subpaths of the first path");
  assert.strictEqual(out.skipped, 1, "the arc path");
  const q = out.paths[0];
  assert.strictEqual(q.kind, "bezier");
  assert.deepStrictEqual(q.points.map((p) => [p.x, p.y]), [[0, 0], [60, 0], [120, 0]]);
  assert.deepStrictEqual([q.points[1].cx1, q.points[1].cy1, q.points[1].cx2, q.points[1].cy2], [20, 20, 40, 20]);
  assert.deepStrictEqual([q.points[2].cx1, q.points[2].cy1], [80, -20], "T mirrors the last control point");
  const s = out.paths[1];
  assert.deepStrictEqual([s.points[2].cx1, s.points[2].cy1], [240, 190], "S mirrors the last cubic handle");
  assert.strictEqual(q.stroke, "#ff0000", "a few colour names are known");
});

test("SVG defaults: no fill attribute = black fill, no stroke = none; rgb() colours; hidden paths left out",
  async function () {
    const { importSvg } = await mod("zk_svgimport.js");
    const svg = '<svg width="896" height="1152"><path d="M0 0 L10 0 L10 10 Z"/>' +
      '<path d="M0 0 L5 5" stroke="rgb(255, 128, 0)" fill="none"/><path d="M1 1 L2 2" display="none" stroke="#fff"/></svg>';
    const out = importSvg(svg, SIZE);
    assert.strictEqual(out.paths.length, 2);
    assert.deepStrictEqual([out.paths[0].fill, out.paths[0].stroke], ["#000000", "none"]);
    assert.strictEqual(out.paths[1].stroke, "#ff8000");
  });

test("refused: not an SVG, a DOCTYPE / entity (no file can expand), and an SVG without paths gives none",
  async function () {
    const { importSvg } = await mod("zk_svgimport.js");
    assert.throws(() => importSvg("hello", SIZE), /not an SVG/);
    assert.throws(() => importSvg('<!DOCTYPE svg [<!ENTITY a "b">]><svg></svg>', SIZE), /not an SVG/);
    assert.deepStrictEqual(importSvg('<svg width="10" height="10"><rect width="5" height="5"/></svg>', SIZE).paths, []);
  });

test("Inkscape-style file: XML header and comments are fine; paths inside defs / clipPath / mask are not shapes",
  async function () {
    const { importSvg } = await mod("zk_svgimport.js");
    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Created with Inkscape -->\n<svg width="896" height="1152" ' +
      'xmlns:sodipodi="x"><sodipodi:namedview id="n"/><defs><clipPath id="c"><path d="M0 0 L9 9"/></clipPath></defs>' +
      '<!-- <path d="M5 5 L6 6"/> --><g><path d="M1 1 L2 2" stroke="#123456" fill="none"/></g></svg>';
    const out = importSvg(svg, SIZE);
    assert.strictEqual(out.paths.length, 1);
    assert.strictEqual(out.paths[0].stroke, "#123456");
  });

test("requester.importSvg: needs a picture; scales to it; bad file -> status, nothing added; counts in the status",
  async function () {
    const { createRequester } = await mod("zk_requester.js");
    const { createBus } = await mod("zk_events.js");
    const K = JSON.parse(require("fs").readFileSync(path.join(WEB, "constants", "zkroto.json"), "utf8"));
    const added = [];
    const status = [];
    let size = { width: 0, height: 0 };
    const CFG = JSON.parse(require("fs").readFileSync(path.join(WEB, "config", "zkroto.json"), "utf8"));
    const ctx = { cfg: CFG, bus: createBus(), status: (m, c) => status.push([m, c]), log: () => null,
      t: (key, v) => K.text[key].replace(/\{(\w+)\}/g, (w, n) => (v && n in v ? v[n] : w)) };
    const req = createRequester(ctx, { store: { getItem: () => null, setItem: () => null }, now: () => new Date(),
      info: () => size, pen: { addPaths: (list) => {
        added.push(...list);
        return list.length;
      } } });
    const svg = '<svg viewBox="0 0 10 10"><path d="M0 0 L10 10" stroke="#000" fill="none"/></svg>';
    assert.strictEqual(req.importSvg(svg, "a.svg"), 0);
    assert.strictEqual(status.pop()[1], "err", "no picture yet");
    size = { width: 100, height: 200 };
    assert.strictEqual(req.importSvg("nope", "b.svg"), 0);
    assert.match(status.pop()[0], /not imported: not an SVG/);
    assert.strictEqual(req.importSvg(svg, "a.svg"), 1);
    assert.deepStrictEqual(added[0].points, [{ x: 0, y: 0 }, { x: 100, y: 200 }]);
    assert.deepStrictEqual(status.pop(), ["1 shapes imported from a.svg (0 left out)", "ok"]);
  });

test("review 2026-11-25: after Z a drawing command starts a NEW subpath at the start point", async function () {
  const { importSvg } = await mod("zk_svgimport.js");
  const out = importSvg('<svg width="896" height="1152"><path d="M0 0 L10 0 L10 10 Z l 5 5" stroke="#000" fill="none"/></svg>',
    SIZE);
  assert.strictEqual(out.paths.length, 2);
  assert.strictEqual(out.paths[0].closed, true);
  assert.deepStrictEqual(out.paths[1].points, [{ x: 0, y: 0 }, { x: 5, y: 5 }]);
});

test("review 2026-11-25: fill / stroke inherited from <g>; skew; bad numbers dropped, not NaN; stroke-width 0 kept",
  async function () {
    const { importSvg } = await mod("zk_svgimport.js");
    const svg = '<svg width="896" height="1152"><g fill="#ff0000" stroke="#00ff00" stroke-width="0">' +
      '<path d="M0 0 L10 0 L10 10 Z"/></g><path transform="skewX(45)" d="M0 10 L0 20" stroke="#000"/>' +
      '<path transform="scale()" d="M1 1 L2 2" stroke="#000"/><path d="M1 1 L2 x" stroke="#000"/></svg>';
    const out = importSvg(svg, SIZE);
    assert.deepStrictEqual([out.paths[0].fill, out.paths[0].stroke, out.paths[0].stroke_width], ["#ff0000", "#00ff00", 0]);
    assert.deepStrictEqual(out.paths[1].points, [{ x: 10, y: 10 }, { x: 20, y: 20 }]);
    assert.deepStrictEqual(out.paths[2].points, [{ x: 1, y: 1 }, { x: 2, y: 2 }], "scale() with no numbers = no scale");
    for (const p of out.paths) {
      assert.ok(p.points.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y)));
    }
  });

test("review 2026-11-25: a file bigger than importMaxBytes is refused with a status, nothing added", async function () {
  const { createRequester } = await mod("zk_requester.js");
  const { createBus } = await mod("zk_events.js");
  const K = JSON.parse(require("fs").readFileSync(path.join(WEB, "constants", "zkroto.json"), "utf8"));
  const CFG = JSON.parse(require("fs").readFileSync(path.join(WEB, "config", "zkroto.json"), "utf8"));
  const status = [];
  const ctx = { cfg: CFG, bus: createBus(), status: (m, c) => status.push([m, c]), log: () => null,
    t: (key, v) => K.text[key].replace(/\{(\w+)\}/g, (w, n) => (v && n in v ? v[n] : w)) };
  let added = 0;
  const req = createRequester(ctx, { store: { getItem: () => null, setItem: () => null }, now: () => new Date(),
    info: () => SIZE, pen: { addPaths: (l) => {
      added += l.length;
      return l.length;
    } } });
  const big = '<svg width="10" height="10"><path d="M0 0 L1 1" stroke="#000"/>' + " ".repeat(CFG.ai.importMaxBytes) + "</svg>";
  assert.strictEqual(req.importSvg(big, "big.svg"), 0);
  assert.strictEqual(added, 0);
  assert.match(status.pop()[0], /not imported/);
});
