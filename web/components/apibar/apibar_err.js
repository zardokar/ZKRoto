// COMPONENT part of apibar: the error box under the bar, right side (wf_zkapi_3 D). One error at a time; title +
// detail from constants; one action by kind: top-up / billing page, the key panel, or try again; X closes.
import { el } from "../../js/zk_dom.js";
import { icon } from "../../js/zk_reqicons.js";

const LINK_KINDS = ["credit", "billing", "spend"];

function iconButton(cls, name, tip, onClick) {
  const b = el("button", { className: "zk-req-btn zk-api-small " + cls, attrs: { type: "button", "data-tip": tip,
    "aria-label": tip }, on: { click: onClick } });
  b.innerHTML = icon(name);
  return b;
}

export function makeErrBox(ctx, actions) {
  const tips = ctx.k.ui.apiTips;
  const node = el("div", { className: "zk-api-err zk-api-pop", attrs: { role: "alert" } });
  const title = el("div", { className: "zk-api-errtitle" });
  const detail = el("div", { className: "zk-api-errdetail" });
  const words = el("span");
  let now = null;
  const link = el("button", { className: "zk-api-link", attrs: { type: "button" }, on: { click: function () {
    globalThis.open(now.link, "_blank", "noopener");
  } } });
  const ext = el("span", { className: "zk-api-ext" });
  ext.innerHTML = icon("ext");
  link.append(words, ext);
  const key = iconButton("zk-api-errkey", "key", tips.key, function () {
    actions.openKey();
  });
  const retry = iconButton("zk-api-retry", "refresh", tips.retry, function () {
    const was = now;
    hide();
    return actions.retry(was);
  });
  const text = el("div", { className: "zk-api-errtext" });
  text.append(title, detail);
  node.append(text, link, key, retry, iconButton("zk-api-errclose", "close", tips.close, hide));

  function hide() {
    node.hidden = true;
    now = null;
  }

  function show(info) {
    if (!info) {
      hide();
      return;
    }
    now = info;
    const t = ctx.k.ui.aiErr[info.kind] || ctx.k.ui.aiErr.other;
    title.textContent = t.title;
    detail.textContent = [t.detail, info.message, info.requestId].filter(Boolean).join(" · ");
    node.classList.toggle("zk-api-warnbox", info.retry === true);
    link.hidden = !(LINK_KINDS.includes(info.kind) && info.link);
    words.textContent = t.action || "";
    key.hidden = info.kind !== "auth";
    retry.hidden = info.retry !== true;
    node.hidden = false;
  }

  node.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      e.preventDefault();
      hide();
    }
  });
  node.hidden = true;
  return { node, show, hide };
}
