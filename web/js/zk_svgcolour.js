// LOGICAL (pure): SVG colour and opacity values -> what the pen keeps (#rrggbb or "none"; opacity 0..1, 1 left out).
// Anything that cannot be read falls back (review 2 finding 5: rgb() with bad numbers gave "#NaNNaNNaN").
const NAMED = { black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000", lime: "#00ff00",
  blue: "#0000ff", yellow: "#ffff00", gray: "#808080", grey: "#808080" };

function hex2(n) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

// One rgb() part: a number 0..255 or a percent of 255; null when it is not a number.
function channel(text) {
  const t = String(text || "").trim();
  const n = Number.parseFloat(t);
  if (!/^[-+]?(\d+\.?\d*|\.\d+)%?$/.test(t) || !Number.isFinite(n)) {
    return null;
  }
  return t.endsWith("%") ? n * 255 / 100 : n;
}

export function colour(value, fallback) {
  const v = String(value === undefined ? fallback : value).trim().toLowerCase();
  if (v === "none" || v === "transparent") {
    return "none";
  }
  if (/^#[0-9a-f]{6}$/.test(v)) {
    return v;
  }
  if (/^#[0-9a-f]{3}$/.test(v)) {
    return "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  }
  const rgb = v.match(/^rgba?\(([^)]*)\)$/);
  if (rgb) {
    const n = rgb[1].split(",").slice(0, 3).map(channel);
    return n.length === 3 && n.every((x) => x !== null) ? "#" + n.map(hex2).join("") : "#000000";
  }
  return NAMED[v] || "#000000";
}

// fill-opacity / stroke-opacity clamped to 0..1; 1 (the default) and unreadable values are left out.
export function opacityOf(a, name) {
  const v = a[name] === undefined ? undefined : Math.min(1, Math.max(0, Number(a[name])));
  return Number.isFinite(v) && v !== 1 ? v : undefined;
}
