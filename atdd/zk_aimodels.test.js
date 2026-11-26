// Model list + key part (Koh 2026-11-25 ~21:0x: list left of the key; fetched once a day; refresh = now; the key typed
// once in the key panel, never in a JSON file). The bar listens to zk:models.
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

async function rig(fail) {
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
  const seen = [];
  const errs = [];
  bus.on(EVENTS.models, (d) => seen.push(d));
  bus.on(EVENTS.aiErr, (d) => errs.push(d));
  let calls = 0;
  const claude = { listModels: async (key) => {
    calls += 1;
    if (fail) {
      throw Object.assign(new Error("x"), { info: { kind: "auth", retry: false } });
    }
    return [{ id: "claude-opus-5-5", name: "Claude Opus 5.5" }, { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5" }];
  } };
  const ctx = { cfg: CFG, k: K, bus, t: (key) => key, status: () => null, log: () => null };
  const models = createAiModels(ctx, { claude, store, today: () => "2026-11-25", clock: () => "21:30" });
  return { models, seen, errs, count: () => calls, data };
}

test("no key: no call; the bar is told there is no key; the model falls back to the config one", async function () {
  const { models, seen, count } = await rig();
  await models.refresh(false);
  assert.strictEqual(count(), 0);
  assert.strictEqual(seen.pop().hasKey, false);
  assert.strictEqual(models.model(), CFG.ai.fallbackModel);
});

test("first key: saved, the list fetched once (loading shown), Sonnet chosen by default, checked time kept",
  async function () {
    const { models, seen, count } = await rig();
    await models.setKey("sk-1");
    assert.strictEqual(count(), 1);
    assert.ok(seen.some((s) => s.loading === true));
    const last = seen.pop();
    assert.deepStrictEqual([last.hasKey, last.loading, last.chosen, last.checked, last.models.length],
      [true, false, "claude-sonnet-5-5", "21:30", 2]);
    await models.refresh(false);
    assert.strictEqual(count(), 1, "same day: the kept list");
    await models.refresh(true);
    assert.strictEqual(count(), 2, "refresh button: now");
    models.choose("claude-opus-5-5");
    assert.strictEqual(models.model(), "claude-opus-5-5");
    assert.strictEqual(models.masked(), "••••sk-1");
  });

test("list fails: the kept list stays, the error box is told why; delete key forgets it", async function () {
  const { models, seen, errs } = await rig(true);
  await models.setKey("sk-bad");
  assert.strictEqual(errs.pop().kind, "auth");
  assert.strictEqual(seen.pop().loading, false);
  models.clearKey();
  assert.strictEqual(models.key(), "");
  assert.strictEqual(seen.pop().hasKey, false);
});
