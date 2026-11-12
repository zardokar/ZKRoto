// COMPONENT: point editing on the overlay canvas (Source view, edit mode only): drag a MediaPipe point of the chosen
// person to where the joint really is; Alt+click puts it back to MediaPipe. Saving goes through the page API.
import { nearest } from "./zk_edits.js";
import { EVENTS } from "./zk_events.js";

export function bindPointEdit(ctx, api, overlay) {
  const { cfg, k, state, el, bus, t } = ctx;
  const canvas = el.overlay;
  let drag = null;

  function sync() {
    canvas.classList.toggle("zk-editing", !!state.editMode);
  }

  // Mouse position in canvas pixels, and the pick radius from screen pixels to canvas pixels.
  function at(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height,
      radius: cfg.edit.pickRadius * canvas.width / r.width };
  }

  function chosen() {
    const pose = state.lastPose;
    return pose && pose.frame === state.frame ? pose.people[state.pov.person] || null : null;
  }

  function done(key, index) {
    ctx.log(t(key, { frame: state.frame, name: k.mpNames[index] }));
  }

  canvas.addEventListener("pointerdown", function (e) {
    const person = chosen();
    if (!state.editMode || !person) {
      return;
    }
    const m = at(e);
    const index = nearest(person.image, canvas.width, canvas.height, m.x, m.y, m.radius);
    if (index < 0) {
      return;
    }
    e.preventDefault();
    if (e.altKey) {
      ctx.run(api.resetPoint, index).then(function () {
        done("editReset", index);
      });
      return;
    }
    drag = { person: state.pov.person, index, x: m.x, y: m.y };
    canvas.setPointerCapture(e.pointerId);
    overlay.setDrag(drag);
    overlay.draw();
  });

  canvas.addEventListener("pointermove", function (e) {
    if (drag) {
      const m = at(e);
      drag.x = m.x;
      drag.y = m.y;
      overlay.draw();
    }
  });

  canvas.addEventListener("pointerup", function () {
    if (!drag) {
      return;
    }
    const d = drag;
    drag = null;
    overlay.setDrag(null);
    const pose = state.lastPose;
    ctx.run(api.movePoint, d.index, d.x / canvas.width * pose.width, d.y / canvas.height * pose.height).then(function () {
      done("edited", d.index);
    });
  });

  bus.on(EVENTS.pov, sync);
  sync();
}
