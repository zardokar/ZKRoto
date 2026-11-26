// Send -> Claude API from the page (Koh 2026-11-25: one press runs to the end; key in this browser; model list once a
// day + refresh). Headers per https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access ;
// model list GET /v1/models (https://platform.claude.com/docs/en/api/models/list).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const WEB = path.join(__dirname, "..", "web");
const CFG = JSON.parse(fs.readFileSync(path.join(WEB, "config", "zkroto.json"), "utf8"));
const K = JSON.parse(fs.readFileSync(path.join(WEB, "constants", "zkroto.json"), "utf8"));

function mod(name) {
  return import(pathToFileURL(path.join(WEB, "js", name)).href);
}

function ok(body) {
  return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(body) };
}

test("every call sends the key, the API version and the browser-access header; no key -> no call", async function () {
  const { createClaude } = await mod("zk_claudeapi.js");
  const seen = [];
  const claude = createClaude({ fetch: async (url, opt) => {
    seen.push([url, opt]);
    return ok({ content: [{ type: "text", text: "{}" }] });
  }, cfg: CFG.ai });
  await claude.ask("sk-abc", { model: "m", max_tokens: 5 });
  const [url, opt] = seen[0];
  assert.strictEqual(url, CFG.ai.apiUrl + "/messages");
  assert.strictEqual(opt.method, "POST");
  assert.deepStrictEqual([opt.headers["x-api-key"], opt.headers["anthropic-version"],
    opt.headers["anthropic-dangerous-direct-browser-access"]], ["sk-abc", CFG.ai.version, "true"]);
  assert.deepStrictEqual(JSON.parse(opt.body), { model: "m", max_tokens: 5 });
  await assert.rejects(claude.ask("", { model: "m" }), (e) => e.info.kind === "auth");
  assert.strictEqual(seen.length, 1);
});

test("model list: all pages read (after_id = last_id), id + display_name kept, newest first as given", async function () {
  const { createClaude } = await mod("zk_claudeapi.js");
  const urls = [];
  const pages = [{ data: [{ id: "a", display_name: "A", type: "model" }], has_more: true, last_id: "a" },
    { data: [{ id: "b", display_name: "B", type: "model" }], has_more: false, last_id: "b" }];
  const claude = createClaude({ fetch: async (url) => {
    urls.push(url);
    return ok(pages[urls.length - 1]);
  }, cfg: CFG.ai });
  const list = await claude.listModels("k");
  assert.deepStrictEqual(list, [{ id: "a", name: "A" }, { id: "b", name: "B" }]);
  assert.match(urls[0], /\/models\?limit=\d+$/);
  assert.match(urls[1], /after_id=a/);
});

test("the brief: model, images (picture + mask) and Koh's words; system text from constants", async function () {
  const { briefBody } = await mod("zk_aibrief.js");
  const body = briefBody({ model: "claude-x", words: "red hair", src: "data:image/png;base64,AAA",
    mask: "data:image/png;base64,BBB", cfg: CFG.ai, k: K });
  assert.strictEqual(body.model, "claude-x");
  assert.strictEqual(body.max_tokens, CFG.ai.maxTokens);
  assert.strictEqual(body.system, K.ai.system);
  const parts = body.messages[0].content;
  assert.deepStrictEqual(parts.slice(0, 2).map((p) => [p.type, p.source.media_type, p.source.data]),
    [["image", "image/png", "AAA"], ["image", "image/png", "BBB"]]);
  assert.ok(parts[2].text.includes("red hair"));
});

test("the recipe Claude returns is read and checked (JSON, also inside a ``` block); limits applied",
  async function () {
    const { readRecipe } = await mod("zk_aibrief.js");
    const msg = (text) => ({ content: [{ type: "text", text }] });
    const r = readRecipe(msg('```json\n{"prompt":"(red hair:1.3), crimson hair","tint":"#B0182A","denoise":0.6,' +
      '"seed":5,"note":"tint start"}\n```'), CFG.ai);
    assert.deepStrictEqual(r, { prompt: "(red hair:1.3), crimson hair", tint: "#b0182a", denoise: 0.6, seed: 5,
      note: "tint start" });
    const d = readRecipe(msg('{"prompt":"blue eyes","tint":null}'), CFG.ai);
    assert.deepStrictEqual([d.tint, d.denoise, d.seed], [null, undefined, CFG.ai.defaultSeed]);
    const clamp = readRecipe(msg('{"prompt":"x","denoise":3}'), CFG.ai);
    assert.strictEqual(clamp.denoise, CFG.ai.denoise[1]);
  });

test("a recipe is refused: no JSON, empty prompt, bad tint, too long, or a word that reads as a minor",
  async function () {
    const { readRecipe } = await mod("zk_aibrief.js");
    const msg = (text) => ({ content: [{ type: "text", text }] });
    for (const bad of ["no json here", '{"prompt":""}', '{"prompt":"x","tint":"red"}',
      '{"prompt":"' + "a".repeat(CFG.ai.maxPrompt + 1) + '"}', '{"prompt":"loli, red hair"}',
      '{"prompt":"red hair, Young Girl"}', '{"prompt":"schoolgirls"}', '{"prompt":"babies, red"}', '{"prompt":"childlike face"}',
      '{"prompt":"lolis"}', '{"prompt":"teenaged"}', '{"prompt":"tween"}', '{"prompt":"middle-school uniform"}',
      '{"prompt":"red hair","note":"made her look like a toddler"}', '{"prompt":"adolescent"}', '{"prompt":"minors"}']) {
      assert.throws(() => readRecipe(msg(bad), CFG.ai), (e) => e.info && e.info.kind === "recipe", bad);
    }
    assert.throws(() => readRecipe({ stop_reason: "refusal", content: [] }, CFG.ai), (e) => e.info.kind === "recipe");
  });

test("key and model list stay in this browser: key masked to its last 4; list fetched once a day", async function () {
  const { createModelStore, maskKey, pickModel } = await mod("zk_modelstore.js");
  const data = {};
  const store = { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => {
    data[k] = String(v);
  }, removeItem: (k) => {
    delete data[k];
  } };
  const s = createModelStore(store);
  assert.strictEqual(s.key(), "");
  s.setKey("  sk-ant-api03-abcdefgh7Q2x \n");
  assert.strictEqual(s.key(), "sk-ant-api03-abcdefgh7Q2x");
  assert.strictEqual(maskKey(s.key()), "••••7Q2x");
  assert.strictEqual(s.due("2026-11-25"), true);
  s.saveModels([{ id: "claude-opus-5-5", name: "Claude Opus 5.5" }, { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5" }],
    "2026-11-25");
  assert.strictEqual(s.due("2026-11-25"), false);
  assert.strictEqual(s.due("2026-11-26"), true);
  assert.strictEqual(pickModel(s.models(), "", CFG.ai.preferModel), "claude-sonnet-5-5");
  assert.strictEqual(pickModel(s.models(), "claude-opus-5-5", CFG.ai.preferModel), "claude-opus-5-5");
  assert.strictEqual(pickModel(s.models(), "gone-model", CFG.ai.preferModel), "claude-sonnet-5-5");
  s.clearKey();
  assert.strictEqual(s.key(), "");
  const broken = createModelStore({ getItem: () => {
    throw new Error("blocked");
  }, setItem: () => {
    throw new Error("blocked");
  }, removeItem: () => null });
  assert.strictEqual(broken.key(), "");
  assert.doesNotThrow(() => broken.setKey("x"));
});

test("the page's recipe builds the same ComfyUI graph as the skill script zk_req_prompt.js (recorded fixture)",
  async function () {
    const { buildPrompt } = await mod("zk_reqrecipe.js");
    const cases = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "reqrecipe_parity.json"), "utf8"));
    for (const c of cases) {
      assert.deepStrictEqual(JSON.parse(JSON.stringify(buildPrompt(c.input))), c.prompt, c.input.id);
    }
  });

test("review 2026-11-25: a seed out of range falls back to the default; the system text says what the recipe always adds",
  async function () {
    const { readRecipe } = await mod("zk_aibrief.js");
    const msg = (text) => ({ content: [{ type: "text", text }] });
    assert.strictEqual(readRecipe(msg('{"prompt":"x","seed":-5}'), CFG.ai).seed, CFG.ai.defaultSeed);
    assert.strictEqual(readRecipe(msg('{"prompt":"x","seed":1e300}'), CFG.ai).seed, CFG.ai.defaultSeed);
    assert.match(K.ai.system, /earrings, jewelry, hair ornament/);
    assert.match(K.ai.system, /adult woman, mature female/);
  });

test("review 2026-11-25: a key with spaces or non-ASCII (pasted Thai text) is not saved; the box says why",
  async function () {
    const { createBus, EVENTS } = await mod("zk_events.js");
    const { createModelStore } = await mod("zk_modelstore.js");
    const { createAiModels } = await mod("zk_aimodels.js");
    const data = {};
    const store = createModelStore({ getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => {
      data[k] = v;
    }, removeItem: (k) => {
      delete data[k];
    } });
    const bus = createBus();
    const errs = [];
    bus.on(EVENTS.aiErr, (d) => errs.push(d));
    const models = createAiModels({ cfg: CFG, k: K, bus, t: (key) => key, log: () => null },
      { claude: { listModels: async () => [] }, store, today: () => "d", clock: () => "t" });
    assert.strictEqual(await models.setKey("ใส่คีย์ sk-ant"), false);
    assert.strictEqual(models.key(), "");
    assert.deepStrictEqual([errs[0].kind, errs[0].retry], ["auth", false]);
  });
