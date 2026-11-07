// COMPONENT: page controls - buttons, fps list, slider, frame box, keys, drag and drop. Calls the API only.
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
  el.btnLoad.onclick = function () {
    quiet(guarded(ctx, api.load)(el.name.value.trim()));
  };
  el.name.onkeydown = function (e) {
    if (e.key === "Enter") {
      el.btnLoad.click();
    }
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
    if (f) {
      quiet(guarded(ctx, api.load)(f));
    }
  };
}

function onKey(ctx, api, e) {
  const t = e.target;
  if (t instanceof HTMLInputElement && !TEXT_INPUT_EXEMPT.includes(t.type)) {
    return;
  }
  const big = e.shiftKey ? ctx.cfg.bigStep : 1;
  const key = e.key.toLowerCase();
  if (e.key === "ArrowRight") {
    e.preventDefault();
    api.step(big);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    api.step(-big);
  } else if (key === "c") {
    quiet(guarded(ctx, api.capture)());
  } else if (key === "p") {
    quiet(guarded(ctx, api.pose)());
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
