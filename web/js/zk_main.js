// Entry of the ZKRoto page: reads config + constants, builds the parts and the layout, exposes window.zk.
// API notes: docs/zk_api.js.md
import { createContext } from "./zk_context.js";
import { makeApi } from "./zk_api.js";
import { mountLayout } from "./zk_layout.js";
import { bindUi, guarded } from "./zk_ui.js";
import { bindPointEdit } from "./zk_pointedit.js";
import { REGISTRY } from "../components/registry.js";
import cfg from "../config/zkroto.json" with { type: "json" };
import k from "../constants/zkroto.json" with { type: "json" };

function start() {
  const ctx = createContext(cfg, k, document);
  const { api, overlay, parts } = makeApi(ctx);
  mountLayout(ctx, parts, REGISTRY, document);
  bindUi(ctx, api, overlay);
  bindPointEdit(ctx, api, overlay);
  ctx.status(ctx.t("ready"));
  window.zk = api;
  const q = new URLSearchParams(location.search);
  if (q.get("fps")) {
    api.setFps(q.get("fps"));
  }
  if (q.get("video")) {
    guarded(ctx, api.load)(q.get("video")).then(function () {
      return q.get("frame") && api.seek(Number(q.get("frame")));
    }).catch(function () {
      return null;
    });
  }
  ctx.log(ctx.t("readyLog", { version: k.version }));
}

start();
