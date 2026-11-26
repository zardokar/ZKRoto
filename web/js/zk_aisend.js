// FACADE part: one press of Send runs to the end (Koh 2026-11-25 21:0x): request folder -> Claude picks the recipe ->
// ComfyUI -> answer in the request folder -> red dot on Compare. No key: zk:needkey, then resume(). Koh's words, Claude's
// words and the words the recipe adds are written into the answer (ZComfy CLAUDE.md 5e). Errors: zk:aierr.
import { EVENTS } from "./zk_events.js";
import { briefBody, readRecipe } from "./zk_aibrief.js";
import { buildPrompt, ADULT_POS, ADULT_NEG, EXTRA_NEG } from "./zk_reqrecipe.js";
import { comfyError, stoppedError, failure } from "./zk_claudeerr.js";

export function createAiSend(ctx, deps) {
  const cfg = ctx.cfg.ai;
  let busy = false;
  let pending = null;
  let last = null;
  let stopped = false;
  let shown = false;
  let ours = null;

  function stage(name, progress) {
    ctx.bus.emit(EVENTS.ai, { stage: name, progress: progress === undefined ? null : progress });
  }

  function showError(info) {
    shown = true;
    ctx.bus.emit(EVENTS.aiErr, info);
    const title = ctx.k.ui.aiErr[info.kind] ? ctx.k.ui.aiErr[info.kind].title : info.kind;
    ctx.status(ctx.t("aiFailed", { title, message: info.message || "" }), "err");
  }

  // Esc (review 2026-11-25): checked after every step, so a stopped run never reaches ComfyUI or the answer.
  function check() {
    if (stopped) {
      throw failure(stoppedError());
    }
  }

  // A wait in short steps, so Esc ends it at once.
  async function pause(ms) {
    for (let left = ms; left > 0 && !stopped; left -= cfg.stopCheckMs) {
      await deps.wait(Math.min(cfg.stopCheckMs, left));
    }
    check();
  }

  async function pictures(req) {
    const shrink = deps.shrink || ((url) => url);
    return { src: await shrink(req.src, cfg.imageMaxSide), mask: await shrink(req.mask, cfg.imageMaxSide) };
  }

  async function askClaude(job) {
    const pics = await pictures(job.req);
    for (let tries = 0; ; tries += 1) {
      check();
      stage("claude");
      try {
        const body = briefBody({ model: job.model, words: job.words, src: pics.src, mask: pics.mask, cfg, k: ctx.k });
        return readRecipe(await deps.claude.ask(deps.models.key(), body), cfg);
      } catch (e) {
        const w = e.info && e.info.kind === "rate" ? e.info.waitS : null;
        if (!(w > 0 && w <= cfg.maxWaitS) || tries >= cfg.retryMax || stopped) {
          throw e;
        }
        await pause(w * 1000);
      }
    }
  }

  // Which part of the mark is the hair (zk_hairsplit.js), uploaded as hair.png; any failure = the whole mark (Koh 00:57).
  async function hairPart(job) {
    try {
      const hair = deps.hair ? await deps.hair(job.req.src, job.req.mask, cfg) : null;
      if (hair) {
        await deps.comfy.upload(job.req.id, "hair.png", hair.blob);
      }
      return hair;
    } catch (e) {
      ctx.log(ctx.t("aiHairFallback", { message: e.message || String(e) }));
      return null;
    }
  }

  async function render(job, recipe) {
    const hair = recipe.tint ? await hairPart(job) : null;
    const prompt = buildPrompt({ id: job.req.id, width: job.req.width, height: job.req.height, prompt: recipe.prompt,
      seed: recipe.seed, tint: recipe.tint, denoise: recipe.denoise, hairMask: hair !== null,
      hairSam: hair !== null && cfg.hairSam === true, samModel: cfg.samModel });
    ctx.log(ctx.t("aiRecipe", { prompt: recipe.prompt, tint: recipe.tint || "-", denoise: prompt[13].inputs.denoise,
      note: recipe.note }));
    check();
    stage("comfy");
    const id = await deps.comfy.queue(prompt);
    ours = id;
    if (stopped) {
      await deps.comfy.interrupt(id);
    }
    check();
    const files = await deps.comfy.wait(id, function (p) {
      stage("comfy", p);
    }, function () {
      return stopped;
    }).finally(function () {
      ours = null;
    });
    if (!files.length) {
      throw failure(comfyError("no picture in the ComfyUI result"));
    }
    check();
    stage("save");
    const meta = { output: files[0].filename, words: job.words, prompt: recipe.prompt, added_positive: ADULT_POS,
      negative: ADULT_NEG + ", " + EXTRA_NEG, tint: recipe.tint, denoise: prompt[13].inputs.denoise, seed: recipe.seed,
      model: job.model, note: recipe.note, by: "claude-api" };
    if (recipe.tint) {
      meta.hair = hair ? "hair only, share " + hair.share : "whole mark";
    }
    const png = await deps.comfy.png(files[0]);
    check();
    return deps.comfy.answer(job.req.id, png, meta);
  }

  async function run(job) {
    busy = true;
    stopped = false;
    last = job;
    if (shown) {
      shown = false;
      ctx.bus.emit(EVENTS.aiErr, null);
    }
    try {
      if (!job.req) {
        stage("write");
        job.req = await deps.request.write();
        if (!job.req) {
          return null;
        }
        check();
      }
      job.recipe = job.recipe || await askClaude(job);
      const entry = await render(job, job.recipe);
      await deps.request.list();
      stage("done");
      ctx.status(ctx.t("aiDone", { id: job.req.id }), "ok");
      return entry;
    } catch (e) {
      if (stopped || (e.info && e.info.kind === "stopped")) {
        ctx.status(ctx.t("aiStopped"), "");
      } else {
        showError(e.info || { kind: "other", retry: false, message: e.message });
      }
      return null;
    } finally {
      busy = false;
      stage("idle");
    }
  }

  async function send(words) {
    const w = String(words || "").trim();
    if (!w || busy) {
      return null;
    }
    if (!deps.models.key()) {
      pending = w;
      ctx.bus.emit(EVENTS.needKey, { words: w });
      return null;
    }
    return run({ words: w, model: deps.models.model(), req: null });
  }

  async function resume() {
    const w = pending;
    pending = null;
    return w ? send(w) : null;
  }

  // The key panel was closed without a key: the words waiting for it are dropped.
  function forget() {
    pending = null;
  }

  async function retry() {
    return last && !busy ? run(Object.assign({}, last, { model: deps.models.model() })) : null;
  }

  // Esc while busy: only OUR run is stopped; ComfyUI is interrupted only while our prompt is the one running.
  async function stop() {
    if (!busy) {
      return;
    }
    stopped = true;
    deps.claude.abort();
    if (ours) {
      await deps.comfy.interrupt(ours);
    }
  }

  return { send, resume, retry, stop, forget, busy: () => busy };
}
