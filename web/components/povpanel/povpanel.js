// COMPONENT povpanel (Camera tab): presets, the five camera values, look at, output size, fit / true camera,
// margins, layers, visibility threshold. Shows the POV settings and sends every change through the POV facade.
import { EVENTS } from "../../js/zk_events.js";
import { el, button } from "../../js/zk_dom.js";
import * as F from "./povpanel_fields.js";
import { pixelOff } from "../../js/zk_outsize.js";

// "x / y from: front + side pictures" takes its depth from the side picture, so the depth slider is hidden there
// (user choice A, 2026-11-10); the button itself shows only when a side picture was found.
const SHEET = "sheet";
const CAMERA_KEYS = ["yaw", "eyeHeight", "distance", "fov", "roll"];
const MARGIN_KEYS = ["top", "bottom", "sides"];
const LAYER_KEYS = ["op", "mp", "face"];
const PERCENT = 100;
const MARGIN_STEP = 1;
const THRESHOLD_ATTRS = { min: 0, max: 1, step: 0.05 };

function items(keys, ui) {
  return keys.map(function (key) {
    return { key, text: ui[key] };
  });
}

function cameraFields(ctx, parts, host) {
  const { cfg, k } = ctx;
  const top = el("div", { className: "zk-row zk-panel-top" });
  top.append(button(k.ui.reset, function () {
    parts.pov.reset();
  }, "zk-reset"));
  const presets = F.group("", items(Object.keys(cfg.pov.presets), k.ui), function (name) {
    parts.pov.preset(name);
  });
  const sliders = CAMERA_KEYS.map(function (key) {
    return F.slider(k.ui[key], cfg.pov.ranges[key], function (v) {
      parts.pov.camera({ [key]: v });
    });
  });
  const lookAt = F.select(items(cfg.pov.lookAt, k.ui), function (v) {
    parts.pov.camera({ lookAt: v });
  });
  const lookRow = el("label", { className: "zk-row zk-look" });
  lookRow.append(el("span", { text: k.ui.lookAt }), lookAt.node);
  host.append(top, presets.node, ...sliders.map(function (s) {
    return s.node;
  }), lookRow);
  return function (pov) {
    sliders.forEach(function (s, i) {
      s.set(pov.camera[CAMERA_KEYS[i]]);
    });
    lookAt.set(pov.camera.lookAt);
  };
}

function outputFields(ctx, parts, host) {
  const { cfg, k, t } = ctx;
  const c = cfg.pov.custom;
  const CUSTOM_ATTRS = { min: c.min, max: c.max, step: c.step };
  const mode = F.group(k.ui.output, items(cfg.pov.outModes, k.ui), function (v) {
    parts.pov.options({ outMode: v });
  });
  const w = F.number(CUSTOM_ATTRS, function (v) {
    parts.pov.options({ custom: [v, ctx.state.pov.custom[1]] });
  });
  const h = F.number(CUSTOM_ATTRS, function (v) {
    parts.pov.options({ custom: [ctx.state.pov.custom[0], v] });
  });
  const warn = el("span", { className: "zk-warn" });
  const custom = el("div", { className: "zk-row zk-custom" });
  custom.append(w.node, el("span", { text: "x" }), h.node, warn);
  const framing = F.group("", items(cfg.pov.framings, k.ui), function (v) {
    parts.pov.options({ framing: v });
  });
  host.append(mode.node, custom, framing.node);
  return function (pov) {
    mode.set(pov.outMode);
    framing.set(pov.framing);
    w.set(pov.custom[0]);
    h.set(pov.custom[1]);
    custom.hidden = pov.outMode !== "custom";
    const s = parts.pov.size();
    const percent = pixelOff(s.width, s.height, cfg.pov);
    warn.textContent = s.warn ? t("customWarn", { width: s.width, height: s.height, percent }) : "";
  };
}

function layerFields(ctx, parts, host) {
  const { cfg, k } = ctx;
  const MARGIN_ATTRS = { min: 0, max: Math.round(cfg.pov.marginMax * PERCENT), step: MARGIN_STEP };
  const margins = MARGIN_KEYS.map(function (key) {
    return F.number(MARGIN_ATTRS, function (v) {
      parts.pov.options({ margins: { [key]: v / PERCENT } });
    });
  });
  const marginRow = el("div", { className: "zk-row zk-margins" });
  marginRow.append(el("span", { text: k.ui.margins }), ...margins.map(function (m) {
    return m.node;
  }));
  const layers = LAYER_KEYS.map(function (key) {
    return F.check(k.ui[key], function (v) {
      parts.pov.options({ layers: { [key]: v } });
    });
  });
  const layerRow = el("div", { className: "zk-row zk-layers" });
  layerRow.append(el("span", { text: k.ui.layers }), ...layers.map(function (c) {
    return c.node;
  }));
  const depth = F.slider(k.ui.depth, cfg.pov.ranges.depth, function (v) {
    parts.pov.options({ depth: v });
  });
  const xy = F.group(k.ui.xyFrom, items(cfg.pov.xyFrom, k.ui), function (v) {
    parts.pov.options({ xy: v });
  });
  const threshold = F.number(THRESHOLD_ATTRS, function (v) {
    parts.pov.options({ threshold: v });
  });
  const thRow = el("label", { className: "zk-row zk-threshold" });
  thRow.append(el("span", { text: k.ui.threshold }), threshold.node);
  host.append(marginRow, xy.node, depth.node, layerRow, thRow);
  return function (pov) {
    margins.forEach(function (m, i) {
      m.set(Math.round(pov.margins[MARGIN_KEYS[i]] * PERCENT));
    });
    layers.forEach(function (c, i) {
      c.set(pov.layers[LAYER_KEYS[i]]);
    });
    threshold.set(pov.threshold);
    depth.set(pov.depth);
    depth.node.hidden = pov.xy === SHEET;
    xy.set(pov.xy);
    xy.show(SHEET, !!ctx.state.side);
  };
}

export function mount(host, ctx, parts) {
  const updates = [cameraFields(ctx, parts, host), outputFields(ctx, parts, host), layerFields(ctx, parts, host)];
  const update = function (pov) {
    for (const u of updates) {
      u(pov);
    }
  };
  ctx.bus.on(EVENTS.pov, update);
  update(ctx.state.pov);
}
