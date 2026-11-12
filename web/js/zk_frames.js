// LOGICAL (pure): frame grid, seek time, shown frame, capture names, input URLs. No DOM, no fetch.
const TOTAL_EPS = 1e-6;
const SHOWN_EPS = 1e-3;
const URL_PREFIX = /^(blob:|https?:|\/)/;
const UNSAFE_RUN = /[^\w.-]+/g;
const EXTENSION = /\.[^.]+$/;
const VIEW_API = "/api/view?type=input";
const STILL = /\.(png|jpe?g|webp)$/i;
const FRONT_WORD = /front(?![a-z])(?!.*front(?![a-z]))/i;

export function parseFps(str) {
  const [a, b = "1"] = String(str).split("/");
  return { num: Number(a), den: Number(b) };
}

export function totalFrames(duration, fps) {
  return Math.max(1, Math.floor(duration * fps + TOTAL_EPS));
}

export function clampFrame(n, total) {
  const r = Math.round(Number(n));
  return Math.min(total - 1, Math.max(0, r));
}

export function seekTime(n, fps) {
  return (n + 0.5) / fps;
}

// mediaTime is the frame start (n/fps) or the seek target ((n + 0.5)/fps), so floor, never round (0.1.0 bug);
// clamp, because after the last frame the video time can snap to the clip end (0.1.3).
export function shownFrame(mediaTime, fps, total) {
  return Math.min(total - 1, Math.floor(mediaTime * fps + SHOWN_EPS));
}

export function pad(n, width) {
  return String(n).padStart(width, "0");
}

export function safeBase(name) {
  return name.replace(EXTENSION, "").replace(UNSAFE_RUN, "_");
}

export function captureName(base, frame, width) {
  return `${base}_f${pad(frame, width)}.png`;
}

export function inputUrl(name) {
  const parts = name.replace(/\\/g, "/").split("/");
  const filename = parts.pop();
  const subfolder = parts.join("/");
  return `${VIEW_API}&filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}`;
}

export function isUrl(src) {
  return URL_PREFIX.test(src);
}

export function nameFromUrl(url) {
  return decodeURIComponent(url.split("/").pop().split("?")[0]);
}

export function nameFromInput(name) {
  return name.replace(/\\/g, "/").split("/").pop();
}

export function isStill(name) {
  return STILL.test(String(name).split("?")[0]);
}

// Character sheet partner (user choice B, 2026-11-10): the same name with the last "front" in the file name
// replaced by "side", same case style (front.png -> side.png, FRA007_Front.png -> FRA007_Side.png); null if none.
export function sideName(name) {
  const s = String(name);
  const cut = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\")) + 1;
  const file = s.slice(cut);
  const m = file.match(FRONT_WORD);
  if (!m) {
    return null;
  }
  const w = m[0];
  const side = w === w.toUpperCase() ? "SIDE" : w[0] === w[0].toUpperCase() ? "Side" : "side";
  return s.slice(0, cut) + file.slice(0, m.index) + side + file.slice(m.index + w.length);
}
