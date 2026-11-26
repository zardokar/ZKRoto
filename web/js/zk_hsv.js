// LOGICAL (pure): colour maths hex <-> rgb <-> hsv, ported from Koh's canvas module (cv_hsv.js, docs/cv_hsv.js.md).
// Rule: hex -> hsv -> hex gives the same hex, else the wheel slowly shifts colours. h in degrees, s and v 0-1;
// greys have s = 0 and h = 0.
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function hexOk(text) {
  return HEX_RE.test(String(text || ""));
}

export function hexToRgb(hex) {
  if (!hexOk(hex)) {
    return null;
  }
  const n = parseInt(String(hex).slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function byteHex(value) {
  const byte = Math.max(0, Math.min(255, Math.round(value)));
  return (byte < 16 ? "0" : "") + byte.toString(16);
}

export function rgbToHex(rgb) {
  if (!rgb) {
    return null;
  }
  return "#" + byteHex(rgb.r) + byteHex(rgb.g) + byteHex(rgb.b);
}

function hueOf(r, g, b, max, d) {
  if (d === 0) {
    return 0;
  }
  let h = 0;
  if (max === r) {
    h = ((g - b) / d) % 6;
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  h *= 60;
  return h < 0 ? h + 360 : h;
}

export function rgbToHsv(rgb) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  return { h: hueOf(r, g, b, max, d), s: max === 0 ? 0 : d / max, v: max };
}

function sector(h, c, x) {
  if (h < 60) {
    return [c, x, 0];
  }
  if (h < 120) {
    return [x, c, 0];
  }
  if (h < 180) {
    return [0, c, x];
  }
  if (h < 240) {
    return [0, x, c];
  }
  if (h < 300) {
    return [x, 0, c];
  }
  return [c, 0, x];
}

export function hsvToRgb(hsv) {
  const h = ((hsv.h % 360) + 360) % 360;
  const s = Math.max(0, Math.min(1, hsv.s));
  const v = Math.max(0, Math.min(1, hsv.v));
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const base = sector(h, c, x);
  return { r: (base[0] + m) * 255, g: (base[1] + m) * 255, b: (base[2] + m) * 255 };
}

export function hexToHsv(hex) {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsv(rgb) : null;
}

export function hsvToHex(hsv) {
  return rgbToHex(hsvToRgb(hsv));
}
