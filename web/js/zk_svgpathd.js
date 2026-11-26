// LOGICAL (pure): SVG path data -> subpaths of absolute points in the pen's form (canvas cv_path.js contract: a
// point with cx1/cy1/cx2/cy2 ends a cubic segment). M L H V C S Q T Z, upper and lower case; Q / T become cubics.
// An arc (A) makes the whole path unusable: { arc: true }.
const TOKEN = /[MLHVCSQTAZmlhvcsqtaz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function tokens(d) {
  return String(d || "").match(TOKEN) || [];
}

function newSub(x, y) {
  return { points: [{ x, y }], closed: false, curved: false };
}

// The state of the walk: pen position, start of the subpath, last cubic / quad control for S / T.
function cursor() {
  return { x: 0, y: 0, sx: 0, sy: 0, lastC: null, lastQ: null, sub: null, out: [], started: false };
}

// After Z a drawing command starts a NEW subpath at the start point (SVG rule; review 2026-11-25).
function ensureOpen(c) {
  if (c.sub && c.sub.closed) {
    c.sub = newSub(c.x, c.y);
    c.out.push(c.sub);
  }
}

function lineTo(c, x, y) {
  c.sub.points.push({ x, y });
  c.x = x;
  c.y = y;
  c.lastC = null;
  c.lastQ = null;
}

function cubicTo(c, x1, y1, x2, y2, x, y) {
  c.sub.points.push({ x, y, cx1: x1, cy1: y1, cx2: x2, cy2: y2 });
  c.sub.curved = true;
  c.x = x;
  c.y = y;
  c.lastC = { x: x2, y: y2 };
  c.lastQ = null;
}

function quadTo(c, qx, qy, x, y) {
  const x0 = c.x;
  const y0 = c.y;
  cubicTo(c, x0 + 2 / 3 * (qx - x0), y0 + 2 / 3 * (qy - y0), x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), x, y);
  c.lastQ = { x: qx, y: qy };
}

function mirror(c, last) {
  return last ? { x: 2 * c.x - last.x, y: 2 * c.y - last.y } : { x: c.x, y: c.y };
}

function moveTo(c, x, y) {
  c.started = true;
  c.sub = newSub(x, y);
  c.out.push(c.sub);
  c.x = x;
  c.y = y;
  c.sx = x;
  c.sy = y;
  c.lastC = null;
  c.lastQ = null;
}

function close(c) {
  if (c.sub) {
    c.sub.closed = true;
  }
  c.x = c.sx;
  c.y = c.sy;
  c.lastC = null;
  c.lastQ = null;
}

// One command with its numbers (already absolute).
function step(c, cmd, a) {
  if (cmd !== "M") {
    ensureOpen(c);
  }
  if (cmd === "M") {
    moveTo(c, a[0], a[1]);
  } else if (cmd === "L") {
    lineTo(c, a[0], a[1]);
  } else if (cmd === "H") {
    lineTo(c, a[0], c.y);
  } else if (cmd === "V") {
    lineTo(c, c.x, a[0]);
  } else if (cmd === "C") {
    cubicTo(c, a[0], a[1], a[2], a[3], a[4], a[5]);
  } else if (cmd === "S") {
    const m = mirror(c, c.lastC);
    cubicTo(c, m.x, m.y, a[0], a[1], a[2], a[3]);
  } else if (cmd === "Q") {
    quadTo(c, a[0], a[1], a[2], a[3]);
  } else if (cmd === "T") {
    const m = mirror(c, c.lastQ);
    quadTo(c, m.x, m.y, a[0], a[1]);
  }
}

// Relative numbers -> absolute (x / y pairs from the pen position; H / V one axis).
function absolute(c, cmd, a) {
  if (cmd === "H") {
    return [a[0] + c.x];
  }
  if (cmd === "V") {
    return [a[0] + c.y];
  }
  return a.map((v, i) => v + (i % 2 ? c.y : c.x));
}

export function parseD(d) {
  const t = tokens(d);
  const c = cursor();
  let i = 0;
  let cmd = null;
  while (i < t.length) {
    if (/[a-z]/i.test(t[i])) {
      cmd = t[i];
      i += 1;
    }
    const up = cmd ? cmd.toUpperCase() : null;
    if (up === "A") {
      return { arc: true, subpaths: [] };
    }
    if (up === "Z") {
      close(c);
      cmd = null;
      continue;
    }
    if (!up || i + ARGS[up] > t.length || (up !== "M" && !c.started)) {
      break;
    }
    const raw = t.slice(i, i + ARGS[up]).map(Number);
    i += ARGS[up];
    const rel = cmd !== up && c.started;
    step(c, up, rel ? absolute(c, up, raw) : raw);
    if (up === "M") {
      cmd = cmd === "m" ? "l" : "L";
    }
  }
  return { arc: false, subpaths: c.out };
}
