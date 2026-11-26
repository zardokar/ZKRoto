// LOGICAL (pure): what the page asks Claude (picture + mask + Koh's words, system text from constants) and how the
// answer is read: one JSON recipe {prompt, tint, denoise, seed, note}, checked before anything reaches ComfyUI.
// A word that reads as a minor is never put into a prompt (ZComfy CLAUDE.md 5e; README hard rules).
import { fmt } from "./zk_text.js";
import { recipeError, failure } from "./zk_claudeerr.js";

function image(dataUrl) {
  const at = dataUrl.indexOf(",");
  const media = dataUrl.slice(5, dataUrl.indexOf(";"));
  return { type: "image", source: { type: "base64", media_type: media, data: dataUrl.slice(at + 1) } };
}

export function briefBody(o) {
  return { model: o.model, max_tokens: o.cfg.maxTokens, system: o.k.ai.system, messages: [{ role: "user",
    content: [image(o.src), image(o.mask), { type: "text", text: fmt(o.k.ai.words, { words: o.words }) }] }] };
}

function refuse(message) {
  throw failure(recipeError(message));
}

function textOf(message) {
  if (!message || message.stop_reason === "refusal") {
    refuse("Claude refused the request");
  }
  return (message.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
}

function jsonIn(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return refuse("no JSON recipe in the answer");
  }
}

const DIGITS = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t" };

// Word starts (child -> children), phrases, and distinct stems inside the text with spaces taken out ("l o l i",
// "sh0ta": digits read as letters, review 2 finding 3). Letters only, so plurals and variants are caught too.
function wordsIn(raw, digits, cfg) {
  const low = " " + raw.replace(/[013457]/g, (d) => digits[d]).replace(/[^a-z]+/g, " ").trim() + " ";
  const joined = low.replace(/ /g, "");
  const stem = cfg.minorStems.find((s) => low.includes(" " + s) || (s.includes(" ") && low.includes(s)));
  const phrase = cfg.minorPhrases.find((p) => low.includes(" " + p + " ") || joined.includes(p.replace(/ /g, "")));
  return stem || phrase || (cfg.minorJoined || []).find((s) => joined.includes(s)) || null;
}

// Ages under 18 as numbers ("17yo", "aged 13"), then the words read twice: 1 as i and 1 as l ("lo1i").
export function minorWord(text, cfg) {
  const raw = String(text || "").toLowerCase();
  const age = (cfg.minorAges || []).find((p) => new RegExp(p).test(raw));
  return age || wordsIn(raw, DIGITS, cfg) || wordsIn(raw, Object.assign({}, DIGITS, { 1: "l" }), cfg);
}

function checkedPrompt(p, cfg) {
  if (typeof p !== "string" || !p.trim()) {
    refuse("empty prompt");
  }
  if (p.length > cfg.maxPrompt) {
    refuse("prompt longer than " + cfg.maxPrompt);
  }
  const bad = minorWord(p, cfg);
  if (bad) {
    refuse("a word that reads as a minor: " + bad);
  }
  return p.trim();
}

function checkedTint(t) {
  if (t === null || t === undefined || t === "") {
    return null;
  }
  if (!/^#[0-9a-f]{6}$/i.test(t)) {
    refuse("tint is not #rrggbb: " + t);
  }
  return t.toLowerCase();
}

export function readRecipe(message, cfg) {
  const r = jsonIn(textOf(message));
  if (!r || typeof r !== "object" || Array.isArray(r)) {
    refuse("the answer is not one JSON object");
  }
  const note = typeof r.note === "string" ? r.note : "";
  if (minorWord(note, cfg)) {
    refuse("a word that reads as a minor in the note");
  }
  const seedOk = Number.isSafeInteger(r.seed) && r.seed >= 0;
  const out = { prompt: checkedPrompt(r.prompt, cfg), tint: checkedTint(r.tint), denoise: undefined,
    seed: seedOk ? r.seed : cfg.defaultSeed, note };
  if (Number.isFinite(r.denoise)) {
    out.denoise = Math.min(cfg.denoise[1], Math.max(cfg.denoise[0], r.denoise));
  }
  return out;
}
