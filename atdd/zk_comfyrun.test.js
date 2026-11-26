// ComfyUI part of Send (the steps zk_req_browser.js did by hand): queue the recipe, wait for it with progress,
// read the output picture, write it into the request folder as an answer (POST /zkroto/answer), stop on Esc.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const WEB = path.join(__dirname, "..", "web");
const CFG = JSON.parse(fs.readFileSync(path.join(WEB, "config", "zkroto.json"), "utf8"));

function mod(name) {
  return import(pathToFileURL(path.join(WEB, "js", name)).href);
}

function json(body, status) {
  return { ok: (status || 200) < 300, status: status || 200, json: async () => body,
    blob: async () => ({ arrayBuffer: async () => Uint8Array.from([137, 80, 78, 71]).buffer }) };
}

async function rig(answers) {
  const { createComfyRun } = await mod("zk_comfyrun.js");
  const calls = [];
  const run = createComfyRun({ cfg: CFG.ai, clientId: "zk-test", wait: async (ms) => calls.push(["wait", ms]),
    fetch: async (url, opt) => {
      calls.push([url, opt && opt.method, opt && opt.body]);
      const a = answers.shift();
      return typeof a === "function" ? a(url) : a;
    } });
  return { run, calls };
}

test("queue: POST /api/prompt with the client id; node errors -> comfy error", async function () {
  const { run, calls } = await rig([json({ prompt_id: "p1", node_errors: {} }), json({ node_errors: { 13: "bad" } }, 400)]);
  assert.strictEqual(await run.queue({ 1: {} }), "p1");
  assert.strictEqual(calls[0][0], "/api/prompt");
  assert.deepStrictEqual(JSON.parse(calls[0][2]), { prompt: { 1: {} }, client_id: "zk-test" });
  await assert.rejects(run.queue({}), (e) => e.info.kind === "comfy");
});

test("wait: polls history every pollMs until success, reports progress (null = unknown), returns the images",
  async function () {
    const done = { p1: { status: { status_str: "success", messages: [] },
      outputs: { 17: { images: [{ filename: "a.png", subfolder: "ZKRoto_req", type: "output" }] } } } };
    const { run, calls } = await rig([json({}), json(done)]);
    const seen = [];
    const files = await run.wait("p1", (p) => seen.push(p));
    assert.deepStrictEqual(files, [{ filename: "a.png", subfolder: "ZKRoto_req", type: "output" }]);
    assert.deepStrictEqual(calls.filter((c) => c[0] === "wait").map((c) => c[1]), [CFG.ai.pollMs]);
    assert.ok(calls.every((c) => c[0] === "wait" || c[0] === "/api/history/p1"));
    assert.ok(seen.length >= 1);
  });

test("progress: ComfyUI's websocket progress of this prompt (value / max) goes to the button; others ignored",
  async function () {
    const { createComfyRun } = await mod("zk_comfyrun.js");
    const sockets = [];
    const done = { p1: { status: { status_str: "success", messages: [] }, outputs: {} } };
    let polls = 0;
    const run = createComfyRun({ cfg: CFG.ai, clientId: "zk-test", wait: async () => {
      const ws = sockets[0];
      ws.onmessage({ data: JSON.stringify({ type: "progress", data: { value: 3, max: 30, prompt_id: "p1" } }) });
      ws.onmessage({ data: JSON.stringify({ type: "progress", data: { value: 9, max: 10, prompt_id: "other" } }) });
      ws.onmessage({ data: "not json" });
    }, fetch: async () => {
      polls += 1;
      return json(polls > 1 ? done : {});
    }, socket: (url) => {
      const ws = { url, closed: false, close: function () {
        this.closed = true;
      } };
      sockets.push(ws);
      return ws;
    } });
    const seen = [];
    await run.wait("p1", (p) => seen.push(p));
    assert.match(sockets[0].url, /\/ws\?clientId=zk-test$/);
    assert.deepStrictEqual(seen, [null, 0.1]);
    assert.strictEqual(sockets[0].closed, true);
  });

test("wait: an execution error or the time limit -> comfy error", async function () {
  const bad = { p1: { status: { status_str: "error", messages: [["execution_error", { exception_message: "CUDA oom" }]] },
    outputs: {} } };
  const a = await rig([json(bad)]);
  await assert.rejects(a.run.wait("p1", () => null), (e) => e.info.kind === "comfy" && /CUDA oom/.test(e.info.message));
  const forever = Array.from({ length: Math.ceil(CFG.ai.comfyTimeoutMs / CFG.ai.pollMs) + 2 }, () => json({}));
  const b = await rig(forever);
  await assert.rejects(b.run.wait("p1", () => null), (e) => e.info.kind === "comfy");
});

test("png + answer: output read through /view, written with the meta through /zkroto/answer", async function () {
  const { run, calls } = await rig([json({}), json({ n: 2, file: "result_2.png" })]);
  const b64 = await run.png({ filename: "a b.png", subfolder: "ZKRoto_req", type: "output" });
  assert.strictEqual(b64, "iVBORw==");
  assert.match(calls[0][0], /^\/view\?filename=a%20b\.png&subfolder=ZKRoto_req&type=output$/);
  const entry = await run.answer("req_20261125_213000", b64, { output: "a b.png", words: "w" });
  assert.deepStrictEqual(entry, { n: 2, file: "result_2.png" });
  assert.strictEqual(calls[1][0], "/zkroto/answer");
  assert.deepStrictEqual(JSON.parse(calls[1][2]), { id: "req_20261125_213000", png: "iVBORw==",
    answer: { output: "a b.png", words: "w" } });
});

test("stop: our prompt running -> POST /api/interrupt; our prompt still waiting -> taken out of the queue only",
  async function () {
    const running = await rig([json({ queue_running: [[5, "p1", {}]], queue_pending: [] }), json({})]);
    await running.run.interrupt("p1");
    assert.deepStrictEqual(running.calls.map((c) => [c[0], c[1]]), [["/api/queue", undefined], ["/api/interrupt", "POST"]]);
    assert.deepStrictEqual(JSON.parse(running.calls[1][2]), { prompt_id: "p1" }, "names our prompt (review 2026-11-25)");
    const waiting = await rig([json({ queue_running: [[4, "other", {}]], queue_pending: [[5, "p1", {}]] }), json({})]);
    await waiting.run.interrupt("p1");
    assert.deepStrictEqual(waiting.calls.map((c) => [c[0], c[1]]), [["/api/queue", undefined], ["/api/queue", "POST"]]);
    assert.deepStrictEqual(JSON.parse(waiting.calls[1][2]), { delete: ["p1"] });
  });

test("review 2026-11-25: wait ends at once when Stop was pressed (a prompt taken out of the queue never gets history)",
  async function () {
    let stop = false;
    const { run } = await rig(Array.from({ length: 50 }, () => json({})));
    const waiting = run.wait("p1", () => null, () => stop);
    stop = true;
    await assert.rejects(waiting, (e) => e.info.kind === "stopped");
  });

test("review 2026-11-25: time limit -> our prompt is taken out of the queue before the error; a bad /view reply is an error",
  async function () {
    const n = Math.ceil(CFG.ai.comfyTimeoutMs / CFG.ai.pollMs) + 1;
    const answers = Array.from({ length: n }, () => json({}));
    answers.push(json({ queue_running: [], queue_pending: [[1, "p1", {}]] }), json({}));
    const { run, calls } = await rig(answers);
    await assert.rejects(run.wait("p1", () => null), (e) => e.info.kind === "comfy");
    assert.deepStrictEqual(calls.filter((c) => c[0] === "/api/queue").map((c) => c[1]), [undefined, "POST"]);
    const bad = await rig([json({ error: "not found" }, 404)]);
    await assert.rejects(bad.run.png({ filename: "a.png", subfolder: "", type: "output" }), (e) => e.info.kind === "comfy");
  });
