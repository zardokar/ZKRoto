// LOGICAL (pure): what went wrong with a call to the Claude API, as one kind the error box knows (Koh 2026-11-25:
// out of money -> top-up link; time out; server down; any error). Codes: https://platform.claude.com/docs/en/api/errors
// (an empty balance is HTTP 400 "credit balance is too low"; a spend-cap 429 has no retry-after).
const CREDIT = /credit balance/i;
const SPEND = /usage limits|spend limit/i;
const SPEND_CODE = "enforced_spend_limit_reached";

function info(kind, retry, more) {
  return Object.assign({ kind, retry, waitS: null, link: null, requestId: null, status: null, message: "" }, more || {});
}

function header(h, name) {
  return h && typeof h.get === "function" ? h.get(name) : null;
}

function byStatus(status, body, h, links) {
  const err = body && body.error ? body.error : {};
  const code = err.details ? err.details.error_code : null;
  const wait = Number(header(h, "retry-after"));
  if (status === 400 && CREDIT.test(err.message || "")) {
    return ["credit", false, { link: links.billing }];
  }
  if (status === 402) {
    return ["billing", false, { link: links.billing }];
  }
  if (status === 401 || status === 403) {
    return ["auth", false, {}];
  }
  if (status === 429 && (code === SPEND_CODE || SPEND.test(err.message || ""))) {
    return ["spend", false, { link: links.billing }];
  }
  if (status === 429) {
    return ["rate", true, { waitS: wait > 0 ? wait : null }];
  }
  if (status === 413) {
    return ["toolarge", false, {}];
  }
  if (status >= 500) {
    return ["busy", header(h, "x-should-retry") !== "false", {}];
  }
  return ["other", false, {}];
}

// o = { status, headers, body (parsed JSON or null), text (raw) } of a reply that was not ok.
export function fromReply(o, links) {
  const body = o.body || null;
  const [kind, retry, more] = byStatus(o.status, body, o.headers, links || {});
  const message = body && body.error ? body.error.message : String(o.text || "").slice(0, 200);
  return info(kind, retry, Object.assign(more, { status: o.status, message,
    requestId: (body && body.request_id) || header(o.headers, "request-id") }));
}

// A call that never got a reply: kind "timeout" when our own time limit ended it, else "noanswer" (network, Esc).
export function fromThrown(e, kind) {
  return info(kind || "noanswer", true, { message: e && e.message ? e.message : String(e) });
}

export function comfyError(message) {
  return info("comfy", true, { message: String(message) });
}

export function stoppedError() {
  return info("stopped", false, { message: "stopped" });
}

export function recipeError(message) {
  return info("recipe", false, { message: String(message) });
}

export function failure(i) {
  const e = new Error(i.kind + ": " + i.message);
  e.info = i;
  return e;
}
