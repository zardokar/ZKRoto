// COMPONENT: page controls - buttons, fps list, slider, frame box, keys (C, O = pose, W = view, E, Ctrl+E, arrows;
// P / V / A belong to the pen tool from 0.4.0, Koh 2026-11-24), drag and drop.
// Calls the API only.
const TEXT_INPUT_EXEMPT = ["range", "checkbox"];

function fillFps(ctx) {
  const sel = ctx.el.fps;
  for (const o of ctx.cfg.fpsOptions) {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    opt.selected = o.value === ctx.cfg.defaultFps;
    sel.appendChild(opt);
  }
}

// Report an error in the status line and the log, then rethrow (API callers still see it).
export function guarded(ctx, fn) {
  return async function (...args) {
    try {
      return await fn(...args);
    } catch (e) {
      ctx.status(e.message, "err");
      ctx.log(ctx.t("error", { message: e.message }));
      throw e;
    }
  };
}

function quiet(promise) {
  promise.catch(function () {
    return null;
  });
}

function bindButtons(ctx, api) {
  const { el } = ctx;
  // After Load the keys belong to the picture again (V A P Z ...), not to the name box (Koh 13:58: V did nothing).
  el.btnLoad.onclick = function () {
    if (el.name.blur) {
      el.name.blur();
    }
    quiet(guarded(ctx, api.load)(el.name.value.trim()));
  };
  el.name.onkeydown = function (e) {
    if (e.key === "Enter") {
      el.btnLoad.click();
    }
  };
  el.btnOpen.onclick = function () {
    el.file.click();
  };
  // The status line opens the log drawer under it (wf_modes round 1); Esc or a second press closes it (L5).
  el.status.onclick = function () {
    el.log.hidden = !el.log.hidden;
    el.status.setAttribute("aria-expanded", String(!el.log.hidden));
  };
  el.file.onchange = function (e) {
    const f = e.target.files[0];
    if (f) {
      quiet(guarded(ctx, api.load)(f));
    }
  };
  el.fps.onchange = function (e) {
    quiet(guarded(ctx, api.setFps)(e.target.value));
  };
  el.btnCapture.onclick = function () {
    quiet(guarded(ctx, api.capture)());
  };
  el.btnPose.onclick = function () {
    quiet(guarded(ctx, api.pose)());
  };
}

function bindFrames(ctx, api, overlay) {
  const { el } = ctx;
  el.showPose.onchange = overlay.draw;
  document.querySelectorAll("[data-step]").forEach(function (b) {
    b.onclick = function () {
      api.step(Number(b.dataset.step));
    };
  });
  el.scrub.oninput = function () {
    api.seek(Number(el.scrub.value));
  };
  el.frame.onchange = function () {
    api.seek(Number(el.frame.value));
  };
}

function bindDrop(ctx, api) {
  const stage = ctx.el.stage;
  stage.ondragover = function (e) {
    e.preventDefault();
  };
  stage.ondrop = function (e) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && /\.svg$/i.test(f.name)) {
      quiet(f.text().then(function (text) {
        return api.importSvg(text, f.name);
      }));
    } else if (f) {
      quiet(guarded(ctx, api.load)(f));
    }
  };
}

// Ctrl+E = Export (also while typing a name, never on key repeat); single keys only outside text fields.
// Letters by e.code (the key's place), so they also work with the Thai keyboard layout.
export function onKey(ctx, api, e) {
  if (e.key === "Escape" && ctx.el && !ctx.el.log.hidden) {
    ctx.el.log.hidden = true;
    ctx.el.status.setAttribute("aria-expanded", "false");
    return;
  }
  // With modes (zk_modeview.js): no page keys before a file; Roto work keys only in Roto; frame keys only with a video.
  const mode = ctx.modeNow ? ctx.modeNow() : "any";
  const video = ctx.sourceNow ? ctx.sourceNow() === "video" : true;
  if (mode === null) {
    return;
  }
  if (e.code === "KeyE" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (mode === "mask") {
      return;
    }
    if (!e.repeat) {
      quiet(guarded(ctx, api.exportPose)());
    }
    return;
  }
  const t = e.target;
  if (t instanceof HTMLInputElement && !TEXT_INPUT_EXEMPT.includes(t.type)) {
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return;
  }
  if (mode === "mask" && ["KeyO", "KeyW", "KeyE"].includes(e.code)) {
    return;
  }
  if (!video && ["KeyC", "ArrowLeft", "ArrowRight"].includes(e.code || e.key)) {
    return;
  }
  const big = e.shiftKey ? ctx.cfg.bigStep : 1;
  if (e.key === "ArrowRight") {
    e.preventDefault();
    api.step(big);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    api.step(-big);
  } else if (e.code === "KeyC") {
    quiet(guarded(ctx, api.capture)());
  } else if (e.code === "KeyO") {
    quiet(guarded(ctx, api.pose)());
  } else if (e.code === "KeyW") {
    api.view();
  } else if (e.code === "KeyE") {
    api.editMode();
  }
}

export function bindUi(ctx, api, overlay) {
  fillFps(ctx);
  bindButtons(ctx, api);
  bindFrames(ctx, api, overlay);
  bindDrop(ctx, api);
  document.addEventListener("keydown", function (e) {
    onKey(ctx, api, e);
  });
}
