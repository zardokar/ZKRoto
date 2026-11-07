// LOGICAL (pure): frame grid, seek time, shown frame, capture names, input URLs. No DOM, no fetch.
const TOTAL_EPS = 1e-6;
const SHOWN_EPS = 1e-3;
const URL_PREFIX = /^(blob:|https?:|\/)/;
const UNSAFE_RUN = /[^\w.-]+/g;
const EXTENSION = /\.[^.]+$/;
const VIEW_API = "/api/view?type=input";

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
