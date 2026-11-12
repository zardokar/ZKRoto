// COMPONENT povview: the POV canvas = what Export writes (letterboxed by CSS), with the person label.
// Orbit on the canvas: drag left/right = yaw, drag up/down = eye height, wheel = distance, double-click = Reset.
import { EVENTS } from "../../js/zk_events.js";
import { el } from "../../js/zk_dom.js";
import { drawOpenPose, drawOpenFace, drawMediaPipe, drawPoints } from "../../js/zk_skeleton.js";

const SOURCE_VIEW = "source";

function bindOrbit(canvas, parts) {
  let last = null;
  canvas.addEventListener("pointerdown", function (e) {
    last = [e.clientX, e.clientY];
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!last) {
      return;
    }
    parts.pov.orbit(e.clientX - last[0], e.clientY - last[1]);
    last = [e.clientX, e.clientY];
  });
  canvas.addEventListener("pointerup", function () {
    last = null;
  });
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    parts.pov.zoom(e.deltaY);
  }, { passive: false });
  canvas.addEventListener("dblclick", function () {
    parts.pov.reset();
  });
}

export function mount(host, ctx, parts) {
  const { cfg, k, bus, state, t } = ctx;
  const info = el("div", { className: "zk-povview-info" });
  const size = el("span", { className: "zk-povview-size" });
  const who = el("span", { className: "zk-povview-person" });
  info.append(size, who);
  const canvas = el("canvas", { className: "zk-povview-canvas" });
  host.append(info, canvas);
  bindOrbit(canvas, parts);

  function drawFace(g, face, s) {
    const pov = state.pov;
    if (pov.layers.mp) {
      drawPoints(g, face.mp, k.colors.people[pov.person], cfg.face.meshPointRadius);
    }
    if (pov.layers.op) {
      drawOpenFace(g, face.op, k.colors.face, [s.width, s.height], cfg.openpose);
    }
  }

  function drawLayers(g, pts, s) {
    const pov = state.pov;
    if (pov.layers.op) {
      drawOpenPose(g, pts.pov.op, k.colors.openpose, [s.width, s.height], cfg.openpose);
    }
    if (pov.layers.face && pts.pov.face) {
      drawFace(g, pts.pov.face, s);
    }
    if (pov.layers.mp) {
      const color = k.colors.people[pov.person];
      const line = Math.max(cfg.overlay.minLineWidth, s.width / cfg.overlay.lineWidthDivisor);
      drawMediaPipe(g, pts.pov.mp, k.mpConnections, function () {
        return color;
      }, { threshold: pov.threshold, lineWidth: line, radius: line * cfg.overlay.pointScale });
    }
  }

  function draw() {
    if (state.pov.view === SOURCE_VIEW) {
      return;
    }
    const s = parts.pov.size();
    canvas.width = s.width;
    canvas.height = s.height;
    const g = canvas.getContext("2d");
    g.fillStyle = k.colors.sheet.background;
    g.fillRect(0, 0, s.width, s.height);
    size.textContent = t("povLabel", { width: s.width, height: s.height, framing: k.ui[state.pov.framing] });
    const pts = parts.pov.points();
    host.dataset.person = String(state.pov.person + 1);
    who.textContent = pts ? t("personLabel", { n: state.pov.person + 1 }) : t("noPose");
    if (pts) {
      drawLayers(g, pts, s);
    }
  }
  bus.on(EVENTS.pov, draw);
  bus.on(EVENTS.pose, draw);
  draw();
}
