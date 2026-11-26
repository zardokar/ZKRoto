// COMPONENT reqbar: header row 2 (wf_zkreq_3, wf_zkapi_3): Import SVG, Export SVG, Send | Compare, icons only, flush
// right. Send opens the word box; its border shows the progress (zk:ai); Esc while busy stops our run. Red dot =
// answers not seen. Talks only to parts.request, parts.ai and the bus.
import { EVENTS } from "../../js/zk_events.js";
import { el } from "../../js/zk_dom.js";
import { icon, ring } from "../../js/zk_reqicons.js";
import { makeWords } from "./reqbar_words.js";

function iconButton(name, tip, onClick) {
  const btn = el("button", { className: "zk-req-btn", attrs: { type: "button", "data-tip": tip, "aria-label": tip },
    on: { click: onClick } });
  btn.innerHTML = icon(name);
  return btn;
}

// Import: the icon clicks a hidden file input (no browser picker look, z-ui Never); the text goes to the request part.
function importButton(ctx, tips, req) {
  const input = el("input", { attrs: { type: "file", accept: ".svg,image/svg+xml" } });
  input.hidden = true;
  input.addEventListener("change", async function () {
    const file = input.files && input.files[0];
    try {
      if (file) {
        req.importSvg(await file.text(), file.name);
      }
    } catch (e) {
      ctx.status(ctx.t("aiImportBad", { message: e.message }), "err");
    }
    input.value = "";
  });
  const btn = iconButton("import", tips.import, function () {
    input.click();
  });
  return { btn, input };
}

// The stage of a Send shows on the plane's own border: run = segment going round, comfy % = border filled.
function showStage(plane, ctx, tips, d) {
  plane.setAttribute("data-stage", d.stage);
  const known = d.progress !== null && d.progress !== undefined;
  plane.setAttribute("data-known", known ? "1" : "0");
  const pct = known ? String(Math.round(d.progress * 100)) : "";
  plane.style.setProperty("--zk-progress", pct);
  const say = { write: ctx.t("aiStageClaude"), claude: ctx.t("aiStageClaude"), save: ctx.t("aiStageSave"),
    comfy: ctx.t("aiStageComfy", { pct: known ? pct + " %" : "" }) };
  plane.setAttribute("data-tip", say[d.stage] || tips.send);
}

export function mount(host, ctx, parts) {
  const { cfg, k, bus } = ctx;
  const tips = k.ui.reqTips;
  const req = parts.request;
  const words = makeWords(ctx, parts);
  const imp = importButton(ctx, tips, req);
  const dot = el("span", { className: "zk-req-dot" });
  const toast = el("span", { className: "zk-req-toast", attrs: { role: "status" } });
  const compare = iconButton("compare", tips.compare, function () {
    bus.emit(EVENTS.compare, { open: true });
  });
  compare.appendChild(dot);
  const plane = iconButton("send", tips.send, function () {
    if (parts.ai.busy && parts.ai.busy()) {
      return;
    }
    words.open();
  });
  const border = el("span", { className: "zk-req-ring" });
  border.innerHTML = ring();
  plane.appendChild(border);
  plane.setAttribute("data-stage", "idle");
  host.append(imp.btn, imp.input, iconButton("svg", tips.svg, function () {
    req.exportSvg();
  }), plane, el("span", { className: "zk-req-divider" }), compare, toast, words.node);
  bus.on(EVENTS.ai, function (d) {
    showStage(plane, ctx, tips, d);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !e.defaultPrevented && !["idle", "done"].includes(plane.getAttribute("data-stage"))) {
      parts.ai.stop();
    }
  });
  dot.hidden = true;
  toast.hidden = true;
  compare.disabled = true;
  bus.on(EVENTS.request, function (d) {
    if (d.sent) {
      toast.textContent = ctx.t("reqSent", { id: d.sent });
      toast.hidden = false;
      setTimeout(function () {
        toast.hidden = true;
      }, cfg.request.toastMs);
      return;
    }
    compare.disabled = !d.answers;
    dot.hidden = !d.unseen;
    dot.textContent = String(d.unseen || "");
  });
  const poll = function () {
    req.list().catch(function () {
      return null;
    });
  };
  poll();
  const timer = setInterval(poll, cfg.request.pollMs);
  if (timer && timer.unref) {
    timer.unref();
  }
}
