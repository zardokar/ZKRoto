// FACADE part: the Claude key and the model list of the bar (Koh 2026-11-25 ~21:0x): list fetched once a day, refresh
// = now, the key typed in the key panel only. Tells the bar through zk:models; a failed list keeps the old one and
// tells the error box (zk:aierr).
import { EVENTS } from "./zk_events.js";
import { maskKey, pickModel } from "./zk_modelstore.js";
import { arrangeModels } from "./zk_modelorder.js";

export function createAiModels(ctx, deps) {
  const cfg = ctx.cfg.ai;
  const store = deps.store;
  let loading = false;
  let checked = "";

  // The bar's order (new set first) also decides the default: the first model naming cfg.preferModel.
  function models() {
    return arrangeModels(store.models(), cfg);
  }

  function model() {
    return pickModel(models(), store.chosen(), cfg.preferModel) || cfg.fallbackModel;
  }

  function tell() {
    ctx.bus.emit(EVENTS.models, { hasKey: !!store.key(), loading, models: models(),
      chosen: pickModel(models(), store.chosen(), cfg.preferModel), checked: checked || store.day() });
  }

  async function refresh(force) {
    const key = store.key();
    if (!key || loading || (!force && !store.due(deps.today()))) {
      tell();
      return store.models();
    }
    loading = true;
    tell();
    try {
      const list = await deps.claude.listModels(key);
      store.saveModels(list, deps.today());
      checked = deps.clock();
    } catch (e) {
      ctx.bus.emit(EVENTS.aiErr, Object.assign({ kind: "other", retry: false, message: e.message }, e.info, { from: "models" }));
      ctx.log(ctx.t("aiModelsFailed", { message: e.message }));
    } finally {
      loading = false;
      tell();
    }
    return store.models();
  }

  // A key is plain ASCII with no spaces; pasted text with Thai letters would only fail later (review 2026-11-25).
  async function setKey(key) {
    if (!/^[\x21-\x7e]+$/.test(String(key || "").trim())) {
      ctx.bus.emit(EVENTS.aiErr, { kind: "auth", retry: false, message: ctx.t("aiKeyBad") });
      return false;
    }
    store.setKey(key);
    tell();
    return refresh(false);
  }

  function clearKey() {
    store.clearKey();
    tell();
  }

  function choose(id) {
    store.choose(id);
    tell();
  }

  function masked() {
    return maskKey(store.key());
  }

  function key() {
    return store.key();
  }

  return { key, model, refresh, setKey, clearKey, choose, masked, tell };
}
