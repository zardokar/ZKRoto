// Grid check (user, voice 2026-11-09 22:0x): a cols x rows grid over the reference picture; for every joint, the
// cell of the reference point and of ZKRoto's point. Same cell = right; else how many cells off and which way.
"use strict";

const SAME = "same";
const NEAR = "near";
const FAR = "far";

function cellOf(p, size, grid) {
  const col = Math.min(grid.cols - 1, Math.max(0, Math.floor((p[0] / size[0]) * grid.cols)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor((p[1] / size[1]) * grid.rows)));
  return [col, row];
}

function direction(dc, dr) {
  const parts = [];
  if (dr !== 0) {
    parts.push(dr < 0 ? `up ${-dr}` : `down ${dr}`);
  }
  if (dc !== 0) {
    parts.push(dc < 0 ? `left ${-dc}` : `right ${dc}`);
  }
  return parts.join(", ");
}

// real, ours: lists of [x, y, c] in pixels of the reference picture; names: one per point.
function compareGrid(real, ours, names, size, grid) {
  const joints = [];
  real.forEach(function (r, i) {
    const o = ours[i];
    if (!(r[2] > 0) || !o || !(o[2] > 0)) {
      return;
    }
    const a = cellOf(r, size, grid);
    const b = cellOf(o, size, grid);
    const dc = b[0] - a[0];
    const dr = b[1] - a[1];
    const steps = Math.max(Math.abs(dc), Math.abs(dr));
    const verdict = steps === 0 ? SAME : steps === 1 ? NEAR : FAR;
    joints.push({ i, name: names[i], real: a, ours: b, off: direction(dc, dr), steps, verdict });
  });
  return { joints, summary: summarize(joints) };
}

function summarize(joints) {
  const count = function (v) {
    return joints.filter(function (j) {
      return j.verdict === v;
    }).length;
  };
  const worst = joints.reduce(function (w, j) {
    return j.steps > (w ? w.steps : -1) ? j : w;
  }, null);
  return {
    n: joints.length, same: count(SAME), near: count(NEAR), far: count(FAR),
    worst: worst ? `${worst.name} ${worst.off || "same"}` : "",
  };
}

module.exports = { cellOf, direction, compareGrid };
