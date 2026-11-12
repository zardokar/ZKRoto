// LOGICAL (pure): output size. Portrait / Landscape of config.pov.portrait (832 x 1216); Custom only: each side
// rounded to the step (64) within min .. max, warning when far from 1 MP. Design doc 1.1.
const PERCENT = 100;
const ONE_DECIMAL = 10;

function roundTo(v, step, min, max) {
  const r = Math.round(Number(v) / step) * step;
  return Math.min(max, Math.max(min, Number.isFinite(r) ? r : min));
}

export function pixelOff(width, height, cfg) {
  const off = Math.abs(width * height - cfg.custom.targetPixels) / cfg.custom.targetPixels;
  return Math.round(off * PERCENT * ONE_DECIMAL) / ONE_DECIMAL;
}

export function outSize(mode, custom, cfg) {
  const [pw, ph] = cfg.portrait;
  if (mode === "landscape") {
    return { width: ph, height: pw, warn: false };
  }
  if (mode !== "custom") {
    return { width: pw, height: ph, warn: false };
  }
  const c = cfg.custom;
  const width = roundTo(custom[0], c.step, c.min, c.max);
  const height = roundTo(custom[1], c.step, c.min, c.max);
  return { width, height, warn: pixelOff(width, height, cfg) > c.warnFraction * PERCENT };
}
