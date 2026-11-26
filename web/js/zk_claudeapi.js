// FACADE part: calls to the Claude API straight from the page (the user's own key; header
// anthropic-dangerous-direct-browser-access, https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access).
// ask() = POST /messages; listModels() = GET /models, every page. Errors carry .info (zk_claudeerr.js).
import { fromReply, fromThrown, failure } from "./zk_claudeerr.js";

function headersFor(key, cfg) {
  return { "x-api-key": key, "anthropic-version": cfg.version, "anthropic-dangerous-direct-browser-access": "true",
    "content-type": "application/json" };
}

function parse(text) {
  try {
    return JSON.parse(text);
  } catch (_e) {
    return null;
  }
}

export function createClaude(deps) {
  const cfg = deps.cfg;
  const setTimer = deps.setTimer || globalThis.setTimeout;
  const clearTimer = deps.clearTimer || globalThis.clearTimeout;
  const live = new Set();

  async function call(key, path, opts) {
    if (!key) {
      throw failure(fromReply({ status: 401, body: { error: { message: "no key" } } }, cfg.links));
    }
    const ctrl = new AbortController();
    let late = false;
    live.add(ctrl);
    const timer = setTimer(function () {
      late = true;
      ctrl.abort();
    }, cfg.timeoutMs);
    let res = null;
    let text = "";
    try {
      res = await deps.fetch(cfg.apiUrl + path, Object.assign({ headers: headersFor(key, cfg), signal: ctrl.signal }, opts));
      text = await res.text();
    } catch (e) {
      throw failure(fromThrown(e, late ? "timeout" : "noanswer"));
    } finally {
      clearTimer(timer);
      live.delete(ctrl);
    }
    const body = parse(text);
    if (!res.ok) {
      throw failure(fromReply({ status: res.status, headers: res.headers, body, text }, cfg.links));
    }
    return body;
  }

  async function ask(key, body) {
    return call(key, "/messages", { method: "POST", body: JSON.stringify(body) });
  }

  async function listModels(key) {
    const out = [];
    let after = "";
    for (;;) {
      const page = await call(key, "/models?limit=" + cfg.modelsPageSize + (after ? "&after_id=" + encodeURIComponent(after) : ""),
        { method: "GET" });
      for (const m of (page && page.data) || []) {
        out.push({ id: m.id, name: m.display_name || m.id });
      }
      if (!page || !page.has_more || !page.last_id) {
        return out;
      }
      after = page.last_id;
    }
  }

  // Esc: every call still running is ended (one controller per call, review 2 finding 7).
  function abort() {
    for (const ctrl of live) {
      ctrl.abort();
    }
  }

  return { ask, listModels, abort };
}
