// Error cases of Send -> Claude API, kept in their own file (Koh, voice 2026-11-25 ~21:0x "แยกสคริปต์เคสเทสให้ดีนะ ...
// ส่งแล้วเงินไม่พอ ส่งแล้ว time out ... เซิร์ฟเวอร์ล่ม ... เออร์เลอร์อะไรก็ลองดู"). Codes and shapes:
// https://platform.claude.com/docs/en/api/errors (read 2026-11-25); empty balance = 400 "credit balance is too low".
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

function headers(map) {
  const m = new Map(Object.entries(map || {}));
  return { get: (k) => (m.has(k.toLowerCase()) ? m.get(k.toLowerCase()) : null) };
}

function reply(status, body, head) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, headers: headers(head), text: async () => text };
}

function apiErr(type, message, extra) {
  return Object.assign({ type: "error", error: { type, message }, request_id: "req_011TEST" }, extra || {});
}

async function kindOf(res) {
  const { createClaude } = await mod("zk_claudeapi.js");
  const claude = createClaude({ fetch: async () => res, cfg: CFG.ai });
  try {
    await claude.ask("sk-test", { model: "m" });
  } catch (e) {
    return e.info;
  }
  return null;
}

test("out of credit: HTTP 400 with 'credit balance is too low' -> credit, link to billing, no retry", async function () {
  const info = await kindOf(reply(400, apiErr("invalid_request_error",
    "Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.")));
  assert.deepStrictEqual([info.kind, info.retry, info.link], ["credit", false, CFG.ai.links.billing]);
  assert.strictEqual(info.requestId, "req_011TEST");
});

test("payment problem: 402 billing_error -> billing, link to billing", async function () {
  const info = await kindOf(reply(402, apiErr("billing_error", "payment method declined")));
  assert.deepStrictEqual([info.kind, info.retry, info.link], ["billing", false, CFG.ai.links.billing]);
});

test("key rejected: 401 -> auth (the box offers the key panel)", async function () {
  const info = await kindOf(reply(401, apiErr("authentication_error", "invalid x-api-key")));
  assert.deepStrictEqual([info.kind, info.retry], ["auth", false]);
});

test("too many requests: 429 with retry-after -> rate, wait that many seconds, retry", async function () {
  const info = await kindOf(reply(429, apiErr("rate_limit_error", "rate limited"), { "retry-after": "12" }));
  assert.deepStrictEqual([info.kind, info.retry, info.waitS], ["rate", true, 12]);
});

test("spend cap: 429 with enforced_spend_limit_reached, or 'usage limits' in the message -> spend, no auto retry",
  async function () {
    const coded = apiErr("rate_limit_error", "limit");
    coded.error.details = { error_code: "enforced_spend_limit_reached" };
    const a = await kindOf(reply(429, coded, { "retry-after": "30" }));
    const b = await kindOf(reply(429, apiErr("rate_limit_error", "You have reached your API usage limits")));
    assert.deepStrictEqual([a.kind, a.retry, a.link], ["spend", false, CFG.ai.links.billing]);
    assert.deepStrictEqual([b.kind, b.retry], ["spend", false]);
  });

test("review 2026-11-25: a plain 429 without retry-after is still a rate limit (retry button, no timed wait)",
  async function () {
    const c = await kindOf(reply(429, apiErr("rate_limit_error", "Number of request tokens has exceeded your rate limit")));
    assert.deepStrictEqual([c.kind, c.retry, c.waitS], ["rate", true, null]);
  });

test("Claude busy: 529 overloaded, 500 api_error, 504 timeout_error -> busy, retry (500 obeys x-should-retry)",
  async function () {
    for (const [status, type] of [[529, "overloaded_error"], [500, "api_error"], [504, "timeout_error"]]) {
      const info = await kindOf(reply(status, apiErr(type, "x")));
      assert.deepStrictEqual([info.kind, info.retry], ["busy", true], String(status));
    }
    const no = await kindOf(reply(500, apiErr("api_error", "x"), { "x-should-retry": "false" }));
    assert.deepStrictEqual([no.kind, no.retry], ["busy", false]);
  });

test("picture too large: 413 -> toolarge, no retry", async function () {
  const info = await kindOf(reply(413, apiErr("request_too_large", "too big")));
  assert.deepStrictEqual([info.kind, info.retry], ["toolarge", false]);
});

test("review 2 (Koh spec d): our own time limit -> timeout; the network is down -> noanswer; both retry", async function () {
  const { createClaude } = await mod("zk_claudeapi.js");
  const timers = [];
  const hang = (url, opt) => new Promise(function (ok, bad) {
    opt.signal.addEventListener("abort", function () {
      const e = new Error("aborted");
      e.name = "AbortError";
      bad(e);
    });
  });
  const slow = createClaude({ fetch: hang, cfg: CFG.ai, setTimer: (fn, ms) => timers.push([fn, ms]), clearTimer: () => null });
  const pending = slow.ask("k", { model: "m" }).catch((e) => e.info);
  assert.strictEqual(timers[0][1], CFG.ai.timeoutMs);
  timers[0][0]();
  const late = await pending;
  assert.deepStrictEqual([late.kind, late.retry], ["timeout", true]);
  const down = createClaude({ fetch: async () => {
    throw new TypeError("Failed to fetch");
  }, cfg: CFG.ai });
  const off = await down.ask("k", { model: "m" }).catch((e) => e.info);
  assert.deepStrictEqual([off.kind, off.retry], ["noanswer", true]);
});

test("anything else: unknown code or a body that is not JSON -> other, with the status and message kept",
  async function () {
    const a = await kindOf(reply(418, apiErr("teapot_error", "short and stout")));
    assert.deepStrictEqual([a.kind, a.status], ["other", 418]);
    assert.match(a.message, /short and stout/);
    const b = await kindOf(reply(502, "<html>bad gateway</html>"));
    assert.deepStrictEqual([b.kind, b.status], ["busy", 502], "a 5xx without a JSON body is still 'busy'");
    const c = await kindOf(reply(404, "nope"));
    assert.strictEqual(c.kind, "other");
  });

test("ComfyUI fails after Claude answered -> comfy, retry; a recipe Claude got wrong -> recipe, no retry",
  async function () {
    const { comfyError, recipeError } = await mod("zk_claudeerr.js");
    assert.deepStrictEqual([comfyError("node error").kind, comfyError("x").retry], ["comfy", true]);
    assert.deepStrictEqual([recipeError("bad").kind, recipeError("x").retry], ["recipe", false]);
  });

test("every kind has a title and a detail text in constants (the error box shows them)", async function () {
  const K = JSON.parse(fs.readFileSync(path.join(WEB, "constants", "zkroto.json"), "utf8"));
  for (const kind of ["credit", "billing", "auth", "rate", "spend", "busy", "toolarge", "noanswer", "comfy", "recipe",
    "other"]) {
    assert.ok(K.ui.aiErr[kind] && K.ui.aiErr[kind].title && K.ui.aiErr[kind].detail, kind);
  }
});
