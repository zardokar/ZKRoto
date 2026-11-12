// DRAW: off-screen images for Export - the OpenPose 18 PNG (black background, full size), the face 70 PNG, the
// full PNG (body 18 + face 70 on one canvas, for one ControlNet openpose input) and the MediaPipe sheet
// (every exported frame of one camera in a grid). makeCanvas(w, h) is given in, so tests can pass a fake canvas.
import { drawOpenPose, drawOpenFace, drawMediaPipe, connectionColor } from "./zk_skeleton.js";
import { sheetLayout } from "./zk_sheetlayout.js";

const PNG = "image/png";
const NONE = 0;

export function toBase64(canvas) {
  return canvas.toDataURL(PNG).split(",")[1];
}

export function createRender(k, cfg, makeCanvas) {
  function renderOpenPose(op, size) {
    const c = makeCanvas(size[0], size[1]);
    const g = c.getContext("2d");
    g.fillStyle = k.colors.sheet.background;
    g.fillRect(0, 0, size[0], size[1]);
    drawOpenPose(g, op, k.colors.openpose, size, cfg.openpose);
    return c;
  }

  // Choice A (design 1.13 F1): the body PNG's drawing, then the face points on top, like the annotator's
  // openpose_full (body, then face). face = null (no face for this person): the body PNG alone.
  function renderFull(op, face, size) {
    const c = renderOpenPose(op, size);
    if (face) {
      drawOpenFace(c.getContext("2d"), face, k.colors.face, size, cfg.openpose);
    }
    return c;
  }

  function renderOpenFace(face, size) {
    const c = makeCanvas(size[0], size[1]);
    const g = c.getContext("2d");
    g.fillStyle = k.colors.sheet.background;
    g.fillRect(0, 0, size[0], size[1]);
    drawOpenFace(g, face, k.colors.face, size, cfg.openpose);
    return c;
  }

  function drawTile(g, tile, data) {
    const colors = k.colors.sheet;
    const s = tile.w / data.width;
    const pts = data.points.map(function (p) {
      return p[2] > 0 ? [tile.x + p[0] * s, tile.y + p[1] * s, p[2]] : [0, 0, 0];
    });
    g.fillStyle = colors.background;
    g.fillRect(tile.x, tile.y, tile.w, tile.h);
    drawMediaPipe(g, pts, k.mpConnections, function (a, b) {
      return connectionColor(a, b, colors, k.mpSides);
    }, { threshold: NONE, lineWidth: cfg.sheet.lineWidth, radius: cfg.sheet.pointRadius });
    g.fillStyle = colors.label;
    g.fillText(tile.label, tile.lx, tile.ly);
  }

  // frames: MediaPipe JSON objects of one camera (all the same size); one tile per frame, in frame order.
  function renderSheet(frames, digits) {
    const first = frames[0];
    const layout = sheetLayout(frames.map(function (f) {
      return f.frame;
    }), [first.width, first.height], cfg.sheet, digits);
    const c = makeCanvas(layout.width, layout.height);
    const g = c.getContext("2d");
    g.fillStyle = k.colors.sheet.tileBorder;
    g.fillRect(0, 0, layout.width, layout.height);
    g.font = cfg.sheet.font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    layout.tiles.forEach(function (tile) {
      const data = frames.find(function (f) {
        return f.frame === tile.frame;
      });
      drawTile(g, tile, data);
    });
    return c;
  }

  return { renderOpenPose, renderOpenFace, renderFull, renderSheet };
}
