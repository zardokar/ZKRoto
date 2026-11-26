// Second Sonnet review of the Send / Import feature (2026-11-25 22:0x): each finding gets a test that was red first.
// Retry after a ComfyUI error must not pay Claude again; the minor-word check must see through spacing and digits.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { CFG, K, mod, rig } = require("./aisend_kit.js");

function down(message) {
  const e = new Error(message);
  e.info = { kind: "comfy", retry: true, message };
  return e;
}

test("finding 2: Retry after a ComfyUI failure reuses Claude's recipe (no second paid call)", async function () {
  let fails = 1;
  const { ai, log } = await rig({ comfyWait: async () => {
    if (fails-- > 0) {
      throw down("node error");
    }
    return [{ filename: "a.png", subfolder: "ZKRoto_req", type: "output" }];
  } });
  await ai.send("red hair");
  await ai.retry();
  assert.strictEqual(log.filter((x) => x[0] === "ask").length, 1, "Claude asked once");
  assert.strictEqual(log.filter((x) => x[0] === "queue").length, 2, "ComfyUI queued twice");
  assert.ok(log.some((x) => x[0] === "answer"));
});

test("finding 8: Esc during the picture download -> no answer is written", async function () {
  const box = {};
  const { ai, log } = await rig({ png: async () => {
    await box.ai.stop();
    return "PNG64";
  } });
  box.ai = ai;
  await ai.send("red hair");
  assert.ok(!log.some((x) => x[0] === "answer"));
});

test("finding 3: minor words hidden by spaces, digits or hyphens are caught; plain adult words pass", async function () {
  const { minorWord } = await mod("zk_aibrief.js");
  for (const bad of ["l o l i", "sh0ta", "L-O-L-I style", "young-looking, petite", "youthful face", "ch1ld", "lo1i",
    "school uniform", "serafuku", "fifteen", "sixteen years", "13 years old", "aged 17", "17yo"]) {
    assert.ok(minorWord(bad, CFG.ai), bad);
  }
  for (const ok of ["(red hair:1.3), crimson hair", "blue eyes, long hair", "mature female, tall", "off shoulder",
    "holding sword, 1girl", "25 years old", "eighteen, adult"]) {
    assert.strictEqual(minorWord(ok, CFG.ai), null, ok);
  }
});

test("finding 9: a fenced null or a JSON that is not an object -> recipe error, not a crash", async function () {
  const { readRecipe } = await mod("zk_aibrief.js");
  for (const text of ["```json\nnull\n```", "```\n[1,2]\n```", "```\n\"x\"\n```"]) {
    const e = (() => {
      try {
        readRecipe({ content: [{ type: "text", text }] }, CFG.ai);
      } catch (err) {
        return err;
      }
      return null;
    })();
    assert.strictEqual(e && e.info && e.info.kind, "recipe", text);
  }
});

test("finding 4: a file with more shapes than importMaxShapes is refused; no spread over huge lists", async function () {
  const { importSvg } = await mod("zk_svgimport.js");
  const n = CFG.ai.importMaxShapes + 1;
  const many = "<svg viewBox=\"0 0 10 10\">" + '<path d="M0 0L1 1"/>'.repeat(n) + "</svg>";
  assert.throws(() => importSvg(many, { width: 10, height: 10 }, CFG.ai.importMaxShapes), /too many shapes/);
  const one = "<svg viewBox=\"0 0 10 10\"><path d=\"" + "M0 0L1 1".repeat(n) + "\"/></svg>";
  assert.throws(() => importSvg(one, { width: 10, height: 10 }, CFG.ai.importMaxShapes), /too many shapes/);
});

test("finding 5: bad or percent rgb() and out-of-range opacity are made safe", async function () {
  const { colour, importSvg } = await mod("zk_svgimport.js");
  assert.strictEqual(colour("rgb()", "#000000"), "#000000");
  assert.strictEqual(colour("rgb(a,b,c)", "#000000"), "#000000");
  assert.strictEqual(colour("rgb(100%,0%,50%)", "#000000"), "#ff0080");
  const out = importSvg('<svg viewBox="0 0 10 10"><path d="M0 0L5 5" fill-opacity="7" stroke-opacity="-1"/></svg>',
    { width: 10, height: 10 });
  assert.strictEqual(out.paths[0].fill_opacity, undefined, "7 clamps to 1 = the default");
  assert.strictEqual(out.paths[0].stroke_opacity, 0);
});

test("finding 7: a model refresh during Send does not take away Esc's abort of the running ask", async function () {
  const { createClaude } = await mod("zk_claudeapi.js");
  const aborted = [];
  const fetch = (url, opt) => new Promise(function (ok, bad) {
    opt.signal.addEventListener("abort", function () {
      aborted.push(url);
      const e = new Error("aborted");
      e.name = "AbortError";
      bad(e);
    });
    if (url.includes("/models")) {
      ok({ ok: true, status: 200, headers: { get: () => null }, text: async () => '{"data":[],"has_more":false}' });
    }
  });
  const claude = createClaude({ fetch, cfg: CFG.ai, setTimer: () => 0, clearTimer: () => null });
  const asking = claude.ask("k", { model: "m" }).catch((e) => e.info);
  await claude.listModels("k");
  claude.abort();
  const info = await asking;
  assert.ok(aborted.some((u) => u.endsWith("/messages")), "the ask was aborted");
  assert.strictEqual(info.kind, "noanswer", "Esc is not our time limit");
});

test("finding 10: a ComfyUI error page that is not JSON -> comfy error, not a SyntaxError", async function () {
  const { createComfyRun } = await mod("zk_comfyrun.js");
  const page = { ok: false, status: 500, json: async () => JSON.parse("<html>"), text: async () => "<html>" };
  const run = createComfyRun({ fetch: async () => page, cfg: CFG.ai, wait: async () => null, clientId: "c" });
  const q = await run.queue({}).catch((e) => e);
  assert.strictEqual(q.info && q.info.kind, "comfy");
  const a = await run.answer("r", "P", {}).catch((e) => e);
  assert.strictEqual(a.info && a.info.kind, "comfy");
});

test("the time-out kind has its own title in the constants", function () {
  assert.ok(K.ui.aiErr.timeout && K.ui.aiErr.timeout.title);
  assert.ok(Number.isInteger(CFG.ai.importMaxShapes) && CFG.ai.importMaxShapes > 0);
});
