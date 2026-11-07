// COMPONENT: the overlay canvas over the video - draws the last pose (MediaPipe 33 points and connections).
const FULL_TURN = Math.PI * 2;

export function createOverlay(ctx, connections) {
  const { cfg, k, el, state } = ctx;
  const canvas = el.overlay;

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
      drawPerson(g, p, colors[i % colors.length], W, H);
    });
  }

  return { clear, resize, draw };
}
