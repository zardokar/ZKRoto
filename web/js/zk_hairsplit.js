// LOGICAL (pure): which pixels under the mark are the hair (Koh 2026-11-26 00:57). Otsu per R, G, B inside the mark, best
// channel wins, bigger side = hair; no clear split -> null (whole mark). Round 2 (colour families) failed the real
// picture and was dropped. Method, sources, proof, limits: docs/zkroto-hairsplit.md.
function histograms(src, mask) {
  const h = [new Float64Array(256), new Float64Array(256), new Float64Array(256)];
  let n = 0;
  for (let k = 0; k < mask.length; k += 4) {
    if (mask[k] > 127) {
      h[0][src[k]] += 1;
      h[1][src[k + 1]] += 1;
      h[2][src[k + 2]] += 1;
      n += 1;
    }
  }
  return { h, n };
}

// Otsu: the cut t (dark = 0..t, bright = t+1..255) with the largest between-class variance.
export function otsu(hist, n) {
  let sum = 0;
  let sq = 0;
  for (let v = 0; v < 256; v++) {
    sum += v * hist[v];
    sq += v * v * hist[v];
  }
  const total = sq / n - (sum / n) * (sum / n);
  let best = { t: -1, between: -1 };
  let w0 = 0;
  let s0 = 0;
  for (let t = 0; t < 255; t++) {
    w0 += hist[t];
    s0 += t * hist[t];
    const w1 = n - w0;
    if (w0 === 0 || w1 === 0) {
      continue;
    }
    const gap = (sum - s0) / w1 - s0 / w0;
    const between = (w0 / n) * (w1 / n) * gap * gap;
    if (between > best.between) {
      best = { t, between, dark: w0, bright: w1, gap };
    }
  }
  return { ...best, eta: total > 0 ? best.between / total : 0 };
}

export function hairSplit(src, mask, cfg) {
  const { h, n } = histograms(src, mask);
  if (n === 0) {
    return null;
  }
  let pick = null;
  for (let c = 0; c < 3; c++) {
    const o = otsu(h[c], n);
    if (o.t >= 0 && (!pick || o.eta * o.gap > pick.eta * pick.gap)) {
      pick = { c, ...o };
    }
  }
  if (!pick || pick.gap < cfg.hairMinGap || pick.eta < cfg.hairMinEta) {
    return null;
  }
  const dark = pick.dark >= pick.bright;
  const share = Math.max(pick.dark, pick.bright) / n;
  if (share > cfg.hairMaxShare || share < cfg.hairMinShare) {
    return null;
  }
  const matte = new Uint8Array(mask.length / 4);
  for (let k = 0; k < mask.length; k += 4) {
    if (mask[k] > 127 && (src[k + pick.c] <= pick.t) === dark) {
      matte[k / 4] = 1;
    }
  }
  return { matte, share: Math.round(share * 1000) / 1000 };
}
