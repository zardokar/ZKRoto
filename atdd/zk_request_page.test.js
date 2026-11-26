// Request to Claude from the page (Koh 2026-11-24 15:37 - 16:24, wf_zkreq_3): the drawn shapes become a white on
// black mask at picture size, the shown picture is the base, one request id per press (local time); Compare shows
// base and answer side by side or as a wipe, with one zoom / pan for both; a red dot counts answers not seen yet.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

function mod(name) {
  return import(pathToFileURL(path.join(__dirname, "..", "web", "js", name)).href);
}

function recorder() {
  const calls = [];
  const g = new Proxy({}, {
    get: function (_t, name) {
      return function (...args) {
        calls.push({ name, args });
      };
    },
    set: function (_t, name, value) {
      calls.push({ name: "set:" + name, args: [value] });
      return true;
    },
  });
  return { g, calls };
}

const SQUARE = [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 50 }];

test("request id = req_YYYYMMDD_HHMMSS in local time", async function () {
  const R = await mod("zk_reqmake.js");
  assert.strictEqual(R.requestId(new Date(2026, 10, 24, 9, 5, 7)), "req_20261124_090507");
});

test("mask: black picture, every shape you can see in white (fill area, stroke at its width), hidden ones left out",
  async function () {
    const R = await mod("zk_reqmake.js");
    const doc = { paths: [
      { id: "a", kind: "poly", closed: false, fill: "#8a8a92", stroke: "none", points: SQUARE },
      { id: "b", kind: "poly", closed: false, fill: "none", stroke: "#ff0000", stroke_width: 6, points: SQUARE },
      { id: "c", kind: "poly", closed: true, fill: "#ffffff", stroke: "none", visible: false, points: SQUARE },
      { id: "d", kind: "poly", closed: true, fill: "none", stroke: "none", points: SQUARE }] };
    const r = recorder();
    const n = R.drawMask(r.g, doc, 100, 80);
    assert.strictEqual(n, 2, "two shapes are seen");
    const names = r.calls.map((c) => c.name);
    assert.deepStrictEqual(r.calls.slice(0, 2).map((c) => c.name), ["set:fillStyle", "fillRect"]);
    assert.deepStrictEqual(r.calls[1].args, [0, 0, 100, 80]);
    assert.strictEqual(names.filter((x) => x === "fill").length, 1);
    assert.strictEqual(names.filter((x) => x === "stroke").length, 1);
    const widths = r.calls.filter((c) => c.name === "set:lineWidth").map((c) => c.args[0]);
    assert.deepStrictEqual(widths, [6]);
    const colours = r.calls.filter((c) => c.name === "set:fillStyle" || c.name === "set:strokeStyle").map((c) => c.args[0]);
    assert.deepStrictEqual(colours, ["#000000", "#ffffff", "#ffffff"]);
  });

test("request body: base64 without the data URL head, picture name, size, frame, shape count", async function () {
  const R = await mod("zk_reqmake.js");
  const b = R.requestBody({ id: "req_20261124_090507", mask: "data:image/png;base64,QUJD",
    src: "data:image/png;base64,REVG", svg: "<svg/>", shapes: 2,
    info: { name: "LK19_ref_eyes.png", width: 358, height: 220, frame: 0 }, time: "2026-11-24T09:05:07" });
  assert.deepStrictEqual(b, { id: "req_20261124_090507", mask: "QUJD", src: "REVG", svg: "<svg/>", req: {
    picture: "LK19_ref_eyes.png", width: 358, height: 220, frame: 0, shapes: 2, time: "2026-11-24T09:05:07" } });
});

test("compare view: fit centres the picture; zoom keeps the point under the mouse; both pictures share it",
  async function () {
    const V = await mod("zk_compareview.js");
    const v = V.fitView(400, 200, 200, 200);
    assert.deepStrictEqual(v, { k: 0.5, ox: 0, oy: 50 });
    const z = V.zoomAt(v, 2, 100, 100, { min: 0.05, max: 32 });
    assert.strictEqual(z.k, 1);
    assert.deepStrictEqual([(100 - z.ox) / z.k, (100 - z.oy) / z.k], [200, 100], "same picture point under the mouse");
    assert.deepStrictEqual(V.panBy(z, 5, -5), { k: 1, ox: z.ox + 5, oy: z.oy - 5 });
    assert.strictEqual(V.zoomAt(v, 1000, 0, 0, { min: 0.05, max: 32 }).k, 32);
    assert.strictEqual(V.css(z), "translate(" + z.ox + "px, " + z.oy + "px) scale(1)");
  });

test("wipe: handle from the mouse x, clamped to the box; arrow keys move it by a step", async function () {
  const V = await mod("zk_compareview.js");
  assert.strictEqual(V.wipeAt(150, 100, 200), 0.25);
  assert.strictEqual(V.wipeAt(50, 100, 200), 0);
  assert.strictEqual(V.wipeAt(900, 100, 200), 1);
  assert.strictEqual(V.wipeKey(0.5, "ArrowLeft", 0.05), 0.45);
  assert.strictEqual(V.wipeKey(0.98, "ArrowRight", 0.05), 1);
  assert.strictEqual(V.wipeKey(0.5, "KeyA", 0.05), 0.5);
});

test("red dot = answers not seen yet; flat list of answers newest request first", async function () {
  const R = await mod("zk_reqmake.js");
  const list = [{ id: "req_2", subfolder: "ZKRoto/req/req_2", req: {}, answers: [{ n: 1, file: "result_1.png" }] },
    { id: "req_1", subfolder: "ZKRoto/req/req_1", req: {}, answers: [{ n: 1, file: "result_1.png" },
      { n: 2, file: "result_2.png" }] }, { id: "req_0", subfolder: "ZKRoto/req/req_0", req: {}, answers: [] }];
  const flat = R.flatAnswers(list);
  assert.deepStrictEqual(flat.map((a) => a.key), ["req_2:1", "req_1:1", "req_1:2"]);
  assert.strictEqual(flat[0].src, "/view?filename=src.png&type=input&subfolder=ZKRoto%2Freq%2Freq_2");
  assert.strictEqual(flat[2].result, "/view?filename=result_2.png&type=input&subfolder=ZKRoto%2Freq%2Freq_1");
  assert.strictEqual(R.unseen(flat, new Set(["req_1:1"])), 2);
});

function fakeCtx() {
  const said = [];
  const events = [];
  return { said, events, ctx: { t: (key, vars) => key + (vars ? JSON.stringify(vars) : ""),
    status: (msg, cls) => said.push([msg, cls]), log: (msg) => said.push([msg, "log"]),
    bus: { emit: (name, d) => events.push([name, d]), on: () => null } } };
}

function deps(over) {
  const posted = [];
  const saved = [];
  const store = new Map();
  const d = Object.assign({
    info: () => ({ name: "LK19_ref_eyes.png", base: "LK19_ref_eyes", width: 100, height: 80, frame: 0 }),
    pen: { doc: () => ({ paths: [{ id: "a", kind: "poly", closed: true, fill: "#8a8a92", stroke: "none",
      points: SQUARE }] }) },
    makeCanvas: () => ({ getContext: () => recorder().g, toDataURL: () => "data:image/png;base64,TUFTSw==" }),
    frameCanvas: () => ({ toDataURL: () => "data:image/png;base64,U1JD" }),
    now: () => new Date(2026, 10, 24, 18, 40, 1),
    fetch: async (url, init) => {
      posted.push([url, init]);
      return { ok: true, json: async () => (url === "/zkroto/requests" ? { requests: [{ id: "req_1",
        subfolder: "ZKRoto/req/req_1", req: {}, answers: [{ n: 1, file: "result_1.png" }] }] } :
        { folder: "ZKRoto/req/req_20261124_184001" }) };
    },
    download: (name, text) => saved.push([name, text]),
    store: { getItem: (k) => store.get(k) || null, setItem: (k, v) => store.set(k, v) },
  }, over || {});
  return { d, posted, saved, store };
}

test("send: one POST to /zkroto/request with mask, picture, shapes and req.json; nothing drawn = nothing sent",
  async function () {
    const Q = await mod("zk_requester.js");
    const f = fakeCtx();
    const { d, posted } = deps();
    const got = await Q.createRequester(f.ctx, d).send();
    assert.deepStrictEqual(got, { id: "req_20261124_184001", folder: "ZKRoto/req/req_20261124_184001", shapes: 1 });
    assert.strictEqual(posted[0][0], "/zkroto/request");
    const body = JSON.parse(posted[0][1].body);
    assert.deepStrictEqual([body.mask, body.src, body.req.shapes, body.req.time], ["TUFTSw==", "U1JD", 1,
      "2026-11-24T18:40:01"]);
    assert.ok(body.svg.startsWith("<svg"));
    const empty = deps({ pen: { doc: () => ({ paths: [] }) } });
    assert.strictEqual(await Q.createRequester(f.ctx, empty.d).send(), null);
    assert.strictEqual(empty.posted.length, 0);
    assert.strictEqual(f.said.at(-1)[1], "err");
  });

test("Export SVG saves <picture>_shapes.svg; the answer list counts what is not seen, kept per browser",
  async function () {
    const Q = await mod("zk_requester.js");
    const f = fakeCtx();
    const { d, saved } = deps();
    const r = Q.createRequester(f.ctx, d);
    assert.strictEqual(r.exportSvg(), "LK19_ref_eyes_shapes.svg");
    assert.ok(saved[0][1].includes('fill="#8a8a92"'));
    await r.list();
    assert.deepStrictEqual(f.events.at(-1)[1], { answers: 1, unseen: 1 });
    r.markSeen("req_1:1");
    assert.deepStrictEqual(f.events.at(-1)[1], { answers: 1, unseen: 0 });
    await Q.createRequester(f.ctx, d).list();
    assert.deepStrictEqual(f.events.at(-1)[1], { answers: 1, unseen: 0 }, "remembered");
  });

test("review: opacity 0 and paths with < 2 points are not in the mask (what you see is what is sent)",
  async function () {
    const R = await mod("zk_reqmake.js");
    const doc = { paths: [
      { id: "a", kind: "poly", closed: true, fill: "#888888", fill_opacity: 0, stroke: "none", points: SQUARE },
      { id: "b", kind: "poly", closed: true, fill: "none", stroke: "#000000", stroke_opacity: 0, points: SQUARE },
      { id: "c", kind: "poly", closed: false, fill: "#888888", stroke: "none", points: [{ x: 1, y: 1 }] },
      { id: "d", kind: "poly", closed: true, fill: "#888888", fill_opacity: 0, stroke: "#000000", points: SQUARE }] };
    const r = recorder();
    assert.strictEqual(R.drawMask(r.g, doc, 10, 10), 1);
    assert.deepStrictEqual(r.calls.filter((c) => c.name === "fill" || c.name === "stroke").map((c) => c.name),
      ["stroke"]);
  });

test("review: two presses in one second get two ids; a failure (tainted picture, network) is said, never thrown",
  async function () {
    const Q = await mod("zk_requester.js");
    const f = fakeCtx();
    const { d, posted } = deps();
    const r = Q.createRequester(f.ctx, d);
    const a = await r.send();
    const b = await r.send();
    assert.notStrictEqual(a.id, b.id);
    assert.strictEqual(b.id, "req_20261124_184002");
    assert.strictEqual(posted.length, 2);
    const bad = deps({ frameCanvas: () => ({ toDataURL: () => {
      throw new Error("The canvas has been tainted");
    } }) });
    assert.strictEqual(await Q.createRequester(f.ctx, bad.d).send(), null);
    assert.match(f.said.at(-1)[0], /tainted/);
    assert.strictEqual(f.said.at(-1)[1], "err");
  });
