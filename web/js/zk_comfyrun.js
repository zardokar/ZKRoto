// FACADE part: the ComfyUI steps of Send that ZComfy scripts/zkreq/zk_req_browser.js did by hand: queue the recipe
// (POST /api/prompt), wait (history poll + websocket progress of this prompt), read the output, write it into the
// request folder as an answer (POST /zkroto/answer), and stop (POST /api/interrupt).
import { comfyError, stoppedError, failure } from "./zk_claudeerr.js";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? B64[n & 63] : "=";
  }
  return out;
}

function post(body) {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function errorText(h) {
  const m = (h.status.messages || []).find((x) => x[0] === "execution_error");
  return m ? (m[1].exception_message || JSON.stringify(m[1])) : h.status.status_str;
}

// An error page that is not JSON (review 2 finding 10) reads as {error: "HTTP <status>"}.
async function jsonOf(res) {
  try {
    return await res.json();
  } catch (_e) {
    return { error: "HTTP " + res.status };
  }
}

export function createComfyRun(deps) {
  const cfg = deps.cfg;

  async function queue(prompt) {
    const res = await deps.fetch("/api/prompt", post({ prompt, client_id: deps.clientId }));
    const out = await jsonOf(res);
    if (!res.ok || (out.node_errors && Object.keys(out.node_errors).length) || !out.prompt_id) {
      throw failure(comfyError(JSON.stringify(out.node_errors || out.error || out)));
    }
    return out.prompt_id;
  }

  function listen(id, onProgress) {
    if (!deps.socket) {
      return null;
    }
    const ws = deps.socket("/ws?clientId=" + encodeURIComponent(deps.clientId));
    ws.onmessage = function (e) {
      let m = null;
      try {
        m = JSON.parse(e.data);
      } catch (_e) {
        return;
      }
      if (m && m.type === "progress" && m.data && m.data.prompt_id === id && m.data.max > 0) {
        onProgress(m.data.value / m.data.max);
      }
    };
    return ws;
  }

  async function history(id) {
    const res = await deps.fetch("/api/history/" + encodeURIComponent(id));
    return res.ok === false ? null : (await res.json())[id];
  }

  // stopped(): Esc was pressed - a prompt taken out of the queue never gets a history entry, so stop polling.
  async function wait(id, onProgress, stopped) {
    const halt = stopped || function () {
      return false;
    };
    onProgress(null);
    const ws = listen(id, onProgress);
    try {
      for (let waited = 0; waited <= cfg.comfyTimeoutMs; waited += cfg.pollMs) {
        if (halt()) {
          throw failure(stoppedError());
        }
        const h = await history(id);
        if (h && h.status && h.status.status_str === "success") {
          return Object.values(h.outputs || {}).flatMap((o) => o.images || []);
        }
        if (h && h.status && h.status.status_str === "error") {
          throw failure(comfyError(errorText(h)));
        }
        await deps.wait(cfg.pollMs);
      }
      await interrupt(id);
      throw failure(comfyError("no result after " + cfg.comfyTimeoutMs + " ms (our prompt was taken out of the queue)"));
    } finally {
      if (ws) {
        ws.close();
      }
    }
  }

  async function png(file) {
    const q = "/view?filename=" + encodeURIComponent(file.filename) + "&subfolder=" +
      encodeURIComponent(file.subfolder || "") + "&type=" + encodeURIComponent(file.type || "output");
    const res = await deps.fetch(q);
    if (res.ok === false) {
      throw failure(comfyError("output picture not readable: HTTP " + res.status));
    }
    const blob = await res.blob();
    return base64(new Uint8Array(await blob.arrayBuffer()));
  }

  async function answer(reqId, b64, meta) {
    const res = await deps.fetch("/zkroto/answer", post({ id: reqId, png: b64, answer: meta }));
    const out = await jsonOf(res);
    if (!res.ok) {
      throw failure(comfyError(out.error || "answer not written"));
    }
    return out;
  }

  // A mask for the recipe into the request folder (ComfyUI POST /api/upload/image, input/ZKRoto/req/<id>/<name>).
  async function upload(reqId, name, blob) {
    const form = new FormData();
    form.append("image", blob, name);
    form.append("subfolder", "ZKRoto/req/" + reqId);
    form.append("type", "input");
    form.append("overwrite", "true");
    const res = await deps.fetch("/api/upload/image", { method: "POST", body: form });
    if (!res.ok) {
      throw failure(comfyError("upload failed: HTTP " + res.status));
    }
  }

  // Stop only our prompt: interrupt when it is the one running, else take it out of the queue (never another job).
  async function interrupt(id) {
    const q = await (await deps.fetch("/api/queue")).json();
    const running = (q.queue_running || []).some((item) => item[1] === id);
    if (running) {
      await deps.fetch("/api/interrupt", post({ prompt_id: id }));
      return;
    }
    await deps.fetch("/api/queue", post({ delete: [id] }));
  }

  return { queue, wait, png, answer, interrupt, upload };
}
