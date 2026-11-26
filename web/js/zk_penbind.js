// FACADE part (zk_pen.js): wires the pen canvas, the keys and the page-drawn cursor to the pen facade. The page
// entry (zk_main.js) calls bindPen once.
import { ICONS } from "./zk_penicons.js";
import { splitCursor } from "./zk_pencursor.js";
import { EVENTS } from "./zk_events.js";

// Wire the pen canvas and the keys to the facade (the page entry calls this once).
export function bindPen(ctx, pen) {
  const canvas = ctx.el.pen;
  canvas.addEventListener("pointerdown", pen.down);
  canvas.addEventListener("pointermove", pen.move);
  canvas.addEventListener("pointerup", pen.up);
  canvas.addEventListener("pointercancel", pen.cancel);
  canvas.addEventListener("pointerleave", pen.leave);
  document.addEventListener("keydown", pen.key);
  document.addEventListener("keyup", pen.keyUp);
  window.addEventListener("blur", pen.blur);
  window.addEventListener("pointerup", pen.windowUp);
  bindSoftCursor(ctx, canvas, pen);
}

function layer(className) {
  const img = document.createElement("img");
  img.className = className;
  img.alt = "";
  img.hidden = true;
  document.body.appendChild(img);
  return img;
}

// Two fixed layers under the root: the dark outline as is, the white ink inverted (mix-blend difference). Parts are
// made once per cursor name; hidden when the pen is not there (POV view: no box; edit mode E: clicks go through).
function bindSoftCursor(ctx, canvas, pen) {
  const imgs = { edge: layer("zk-softedge"), ink: layer("zk-softink") };
  const made = new Map();
  let at = null;
  let shown = "";
  function partsOf(name) {
    if (!made.has(name)) {
      made.set(name, ICONS[name] ? splitCursor(ICONS[name]) : null);
    }
    return made.get(name);
  }
  function place(name) {
    const now = name || pen.cursor();
    const parts = partsOf(now);
    const live = !!(parts && at && canvas.getBoundingClientRect().width && !(ctx.state && ctx.state.editMode));
    const key = live ? `${now} ${at.x} ${at.y}` : "";
    if (key === shown) {
      return;
    }
    shown = key;
    for (const part of ["edge", "ink"]) {
      imgs[part].hidden = !live;
      if (live) {
        imgs[part].src = imgs[part].src === parts[part].uri ? imgs[part].src : parts[part].uri;
        imgs[part].style.transform = `translate(${at.x - parts[part].hx}px, ${at.y - parts[part].hy}px)`;
      }
    }
  }
  canvas.addEventListener("pointermove", function (e) {
    at = { x: e.clientX, y: e.clientY };
    place();
  });
  canvas.addEventListener("pointerleave", function () {
    at = null;
    place();
  });
  ctx.bus.on(EVENTS.pov, function () {
    place();
  });
  pen.softCursor(place);
}
