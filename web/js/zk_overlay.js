// COMPONENT: the overlay canvas over the video - draws the last pose (MediaPipe 33 points and connections);
// the person POV and Export use is drawn solid, the other faded; the face mesh as dots when the Face layer is on.
// Edit mode: bigger points for the chosen person, a ring on edited points, the dragged point where the mouse is.
const FULL_TURN = Math.PI * 2;

export function createOverlay(ctx, connections) {
  const { cfg, k, el, state } = ctx;
  const canvas = el.overlay;
  let drag = null;

  function clear() {
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }

  function resize(w, h) {
    canvas.width = w;
    canvas.height = h;
  }

  function drawPerson(g, p, color, W, H) {
    g.strokeStyle = color;
    g.fillStyle = color;
    for (const { start, end } of connections()) {
      const a = p.image[start];
      const b = p.image[end];
      if (!a || !b) {
        continue;
      }
      g.beginPath();
      g.moveTo(a[0] * W, a[1] * H);
      g.lineTo(b[0] * W, b[1] * H);
      g.stroke();
    }
    for (const q of p.image) {
      g.beginPath();
      g.arc(q[0] * W, q[1] * H, g.lineWidth * cfg.overlay.pointScale, 0, FULL_TURN);
      g.fill();
    }
    if (p.face && state.pov.layers.face) {
      drawFace(g, p.face, W, H);
    }
  }

  // The 478-point face mesh as small dots (fill colour already set for this person).
  function drawFace(g, face, W, H) {
    for (const q of face.image) {
      g.beginPath();
      g.arc(q[0] * W, q[1] * H, cfg.face.meshPointRadius, 0, FULL_TURN);
      g.fill();
    }
  }

  // A ring seen on light and dark pictures: a dark stroke under a light one.
  function ring(g, x, y, r) {
    const w = g.lineWidth;
    for (const [color, width] of [[cfg.edit.ringShadow, w + 2], [cfg.edit.ringColor, w]]) {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      g.arc(x, y, r, 0, FULL_TURN);
      g.stroke();
    }
    g.lineWidth = w;
  }

  function drawEdit(g, p, W, H) {
    const r = g.lineWidth * cfg.overlay.pointScale * cfg.edit.handleScale;
    for (const i of p.edited || []) {
      ring(g, p.image[i][0] * W, p.image[i][1] * H, r * 1.6);
    }
    for (const q of p.image) {
      g.beginPath();
      g.arc(q[0] * W, q[1] * H, r, 0, FULL_TURN);
      g.fill();
    }
    if (drag) {
      const q = p.image[drag.index];
      g.strokeStyle = cfg.edit.ringShadow;
      g.beginPath();
      g.moveTo(q[0] * W, q[1] * H);
      g.lineTo(drag.x, drag.y);
      g.stroke();
      ring(g, drag.x, drag.y, r * 1.6);
    }
  }

  function draw() {
    clear();
    if (!el.showPose.checked || !state.lastPose) {
      return;
    }
    const g = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const colors = k.colors.people;
    g.lineWidth = Math.max(cfg.overlay.minLineWidth, W / cfg.overlay.lineWidthDivisor);
    state.lastPose.people.forEach(function (p, i) {
      g.globalAlpha = i === state.pov.person ? 1 : k.colors.faded;
      drawPerson(g, p, colors[i % colors.length], W, H);
      if (state.editMode && i === state.pov.person) {
        drawEdit(g, p, W, H);
      }
    });
    g.globalAlpha = 1;
  }

  return { clear, resize, draw, setDrag: function (d) {
    drag = d;
  } };
}
