// COMPONENT minimap: top view - the person (dot + facing arrow), the source camera, the POV eye and its view cone.
// Seen from above: X to the right, Z (towards the source camera) down; the chosen person's hips in the middle.
import { EVENTS } from "../../js/zk_events.js";
import { el } from "../../js/zk_dom.js";
import { toYUp } from "../../js/zk_camera.js";

const DEG = Math.PI / 180;
const FULL_TURN = Math.PI * 2;
const SIZE = [240, 150];
const SOURCE_Z = 2.5;
const HIPS = [23, 24];
const SHOULDERS = [11, 12];
const SOURCE_BOX = 8;

function line(g, a, b) {
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.stroke();
}

function dot(g, p, r) {
  g.beginPath();
  g.arc(p[0], p[1], r, 0, FULL_TURN);
  g.fill();
}

export function mount(host, ctx, parts) {
  const { cfg, k, bus, state } = ctx;
  const m = cfg.minimap;
  host.append(el("div", { className: "zk-minimap-title", text: k.ui.topView }));
  const canvas = el("canvas", { className: "zk-minimap-canvas" });
  canvas.width = SIZE[0];
  canvas.height = SIZE[1];
  host.append(canvas);

  function draw() {
    const g = canvas.getContext("2d");
    const c = k.colors.minimap;
    g.fillStyle = c.background;
    g.fillRect(0, 0, SIZE[0], SIZE[1]);
    const person = parts.pov.chosen();
    const pts = parts.pov.points();
    if (!person || !pts) {
      return;
    }
    const w = toYUp(person.world);
    const hips = [(w[HIPS[0]][0] + w[HIPS[1]][0]) / 2, (w[HIPS[0]][2] + w[HIPS[1]][2]) / 2];
    const scale = SIZE[0] / m.metresAcross;
    const at = function (x, z) {
      return [SIZE[0] / 2 + (x - hips[0]) * scale, SIZE[1] / 2 + (z - hips[1]) * scale];
    };
    const [l, r] = SHOULDERS.map(function (i) {
      return w[i];
    });
    const facing = [-(l[2] - r[2]), l[0] - r[0]];
    const len = Math.hypot(...facing) || 1;
    const me = at(hips[0], hips[1]);
    g.strokeStyle = k.colors.people[state.pov.person];
    g.fillStyle = k.colors.people[state.pov.person];
    line(g, me, [me[0] + (facing[0] / len) * m.coneLength * scale, me[1] + (facing[1] / len) * m.coneLength * scale]);
    dot(g, me, m.personRadius);
    const src = at(hips[0], SOURCE_Z);
    g.fillStyle = c.source;
    g.fillRect(src[0] - SOURCE_BOX, Math.min(src[1], SIZE[1] - SOURCE_BOX), SOURCE_BOX * 2, SOURCE_BOX);
    const eye = at(pts.pov.eye[0], pts.pov.eye[2]);
    const yaw = state.pov.camera.yaw * DEG;
    const half = (state.pov.camera.fov / 2) * DEG;
    g.strokeStyle = c.cone;
    for (const a of [-half, half]) {
      const dir = [-Math.sin(yaw + a), -Math.cos(yaw + a)];
      line(g, eye, [eye[0] + dir[0] * m.coneLength * 2 * scale, eye[1] + dir[1] * m.coneLength * 2 * scale]);
    }
    g.fillStyle = c.eye;
    dot(g, eye, m.eyeRadius);
  }
  bus.on(EVENTS.pov, draw);
  bus.on(EVENTS.pose, draw);
  draw();
}
