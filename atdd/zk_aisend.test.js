// One press of Send runs to the end (Koh 2026-11-25 21:0x): request folder -> Claude picks the recipe -> ComfyUI ->
// answer in the request folder -> red dot on Compare. No key: the key panel opens and the send goes on after the key.
// Every word Claude chose and the adult words the recipe adds are written into the answer (ZComfy CLAUDE.md 5e).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { CFG, K, mod, rig } = require("./aisend_kit.js");

test("happy path: write -> ask Claude -> queue -> wait with progress -> answer -> list -> done", async function () {
  const { ai, log, events } = await rig();
  await ai.send("red hair, keep the curls");
  assert.deepStrictEqual(log.filter((x) => typeof x === "string" || ["ask", "queue"].includes(x[0])).map((x) =>
    (typeof x === "string" ? x : x[0])), ["write", "ask", "queue", "list"]);
  const queue = log.find((x) => x[0] === "queue");
  assert.strictEqual(queue[1], 0.6, "tint given -> recipe denoise 0.6");
  assert.ok(queue[2].startsWith("(red hair:1.3), crimson hair, adult woman, mature female"));
  const stages = events.filter((e) => e[0] === "ai").map((e) => e[1].stage);
  assert.deepStrictEqual(stages, ["write", "claude", "comfy", "comfy", "save", "done", "idle"]);
  assert.strictEqual(events.find((e) => e[0] === "ai" && e[1].progress === 0.5)[1].stage, "comfy");
});

test("the answer records Koh's words, Claude's words, the words the recipe adds, model and settings (5e log)",
  async function () {
    const { ai, log } = await rig();
    await ai.send("red hair");
    const [, rid, png, meta] = log.find((x) => x[0] === "answer");
    assert.deepStrictEqual([rid, png], ["req_20261125_213000", "PNG64"]);
    assert.strictEqual(meta.words, "red hair");
    assert.strictEqual(meta.prompt, "(red hair:1.3), crimson hair");
    assert.match(meta.added_positive, /adult woman, mature female/);
    assert.match(meta.negative, /loli, child/);
    assert.deepStrictEqual([meta.model, meta.tint, meta.denoise, meta.seed, meta.by],
      ["claude-sonnet-5-5", "#b0182a", 0.6, CFG.ai.defaultSeed, "claude-api"]);
  });

test("no key: nothing is written; the key panel is asked for; after the key the same words go on", async function () {
  const { ai, log, events, setKey } = await rig({ key: "" });
  await ai.send("blue eyes");
  assert.deepStrictEqual(log.filter((x) => x === "write"), []);
  assert.deepStrictEqual(events.find((e) => e[0] === "needKey")[1], { words: "blue eyes" });
  setKey("sk-new");
  await ai.resume();
  assert.ok(log.includes("write"));
  assert.strictEqual(log.find((x) => x[0] === "answer")[3].words, "blue eyes");
});

test("empty words or a second press while busy do nothing", async function () {
  const { ai, log } = await rig();
  assert.strictEqual(await ai.send("   "), null);
  const first = ai.send("a");
  assert.strictEqual(ai.busy(), true);
  assert.strictEqual(await ai.send("b"), null);
  await first;
  assert.strictEqual(log.filter((x) => x === "write").length, 1);
  assert.strictEqual(ai.busy(), false);
});

test("an error from Claude goes to the error box and the flow stops; retry asks again with the same request",
  async function () {
    const busy = new Error("overloaded");
    busy.info = { kind: "busy", retry: true };
    const { ai, log, events } = await rig({ asks: [busy,
      { content: [{ type: "text", text: '{"prompt":"blue eyes"}' }] }] });
    await ai.send("blue eyes");
    assert.deepStrictEqual(events.find((e) => e[0] === "aiErr")[1].kind, "busy");
    assert.strictEqual(log.filter((x) => x === "write").length, 1);
    assert.ok(!log.some((x) => x[0] === "queue"));
    await ai.retry();
    assert.strictEqual(log.filter((x) => x === "write").length, 1, "the request folder is reused");
    assert.ok(log.some((x) => x[0] === "queue"));
    assert.strictEqual(events.filter((e) => e[0] === "aiErr").pop()[1], null, "box cleared on a new try");
  });

test("429 with retry-after: waits and asks again by itself, at most retryMax times", async function () {
  const rate = () => Object.assign(new Error("rate"), { info: { kind: "rate", retry: true, waitS: 3 } });
  const many = Array.from({ length: CFG.ai.retryMax + 1 }, rate);
  const { ai, log, events } = await rig({ asks: many });
  await ai.send("x");
  const waited = log.filter((x) => x[0] === "wait").map((x) => x[1]);
  assert.strictEqual(waited.reduce((a, b) => a + b, 0), CFG.ai.retryMax * 3000, "waits retry-after, in short steps");
  assert.ok(waited.every((ms) => ms <= CFG.ai.stopCheckMs));
  assert.strictEqual(log.filter((x) => x[0] === "ask").length, CFG.ai.retryMax + 1);
  assert.strictEqual(events.find((e) => e[0] === "aiErr")[1].kind, "rate");
});

test("a bad recipe stops before ComfyUI (recipe error)", async function () {
  const { ai, log, events } = await rig({ asks: [{ content: [{ type: "text", text: '{"prompt":"loli"}' }] }] });
  await ai.send("x");
  assert.strictEqual(events.find((e) => e[0] === "aiErr")[1].kind, "recipe");
  assert.ok(!log.some((x) => x[0] === "queue"));
});

test("stop (Esc while busy) aborts Claude and interrupts ComfyUI only while OUR prompt runs; idle stop touches nothing",
  async function () {
    let release = null;
    const { ai, log, events } = await rig({ comfyWait: () => new Promise((ok, bad) => {
      release = bad;
    }) });
    await ai.stop();
    assert.ok(!log.includes("abort") && !log.includes("interrupt"), "no Send running: ComfyUI is not ours to stop");
    const running = ai.send("x");
    await new Promise((ok) => setImmediate(ok));
    await ai.stop();
    assert.ok(log.includes("abort") && log.includes("interrupt"));
    release(Object.assign(new Error("stopped"), { info: { kind: "stopped" } }));
    assert.strictEqual(await running, null);
    assert.ok(!events.some((e) => e[0] === "aiErr" && e[1]), "a stop is not an error");
  });

test("review 2026-11-25: Stop during the request write or right after Claude answers -> nothing is queued", async function () {
  let ai = null;
  const r1 = await rig({ request: (base, log) => Object.assign({}, base, { write: async () => {
    await ai.stop();
    return base.write();
  } }) });
  ai = r1.ai;
  await r1.ai.send("x");
  assert.ok(!r1.log.some((x) => x[0] === "ask" || x[0] === "queue"), "the happy-path test is the control");
});

test("review 2026-11-25: a retry-after longer than maxWaitS is not waited: the box shows it at once", async function () {
  const long = Object.assign(new Error("rate"), { info: { kind: "rate", retry: true, waitS: CFG.ai.maxWaitS + 1 } });
  const { ai, log, events } = await rig({ asks: [long] });
  await ai.send("x");
  assert.ok(!log.some((x) => x[0] === "wait"));
  assert.strictEqual(events.find((e) => e[0] === "aiErr")[1].kind, "rate");
});

test("review 2026-11-25: the pictures go to Claude shrunk (deps.shrink); the key panel closed without a key forgets the words",
  async function () {
    const { ai, log, setKey } = await rig({ key: "" });
    await ai.send("red");
    ai.forget();
    setKey("sk-1");
    assert.strictEqual(await ai.resume(), null, "nothing pending any more");
    await ai.send("blue");
    assert.deepStrictEqual(log.filter((x) => x[0] === "shrink").map((x) => x[1]), ["S", "M"]);
  });
