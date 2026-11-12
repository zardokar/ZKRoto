// LOGICAL (pure): grid of the MediaPipe sheet - one tile per exported frame, in frame order, label under each tile.
const LABEL_MID = 2;

export function sheetLayout(frames, cameraSize, cfg, digits) {
  const list = [...new Set(frames)].sort(function (a, b) {
    return a - b;
  });
  const cols = Math.max(1, Math.min(list.length, cfg.columns));
  const rows = Math.max(1, Math.ceil(list.length / cols));
  const w = cfg.tileWidth;
  const h = Math.round((w * cameraSize[1]) / cameraSize[0]);
  const cellW = w + cfg.gap;
  const cellH = h + cfg.labelHeight + cfg.gap;
  const tiles = list.map(function (frame, i) {
    const x = cfg.gap + (i % cols) * cellW;
    const y = cfg.gap + Math.floor(i / cols) * cellH;
    const label = `f${String(frame).padStart(digits, "0")}`;
    return { frame, label, x, y, w, h, lx: x + w / LABEL_MID, ly: y + h + cfg.labelHeight / LABEL_MID };
  });
  return { width: cfg.gap + cols * cellW, height: cfg.gap + rows * cellH, tiles };
}
