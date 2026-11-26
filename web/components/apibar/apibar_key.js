// COMPONENT part of apibar: the key panel (wf_zkapi_5, Koh OK 22:14). Head: title | quiet X; row: field with the eye
// inside | save (accent only when a key is typed); foot: kept here, get a key | red trash only when a key is saved.
// "no key yet" = Send was pressed without a key: the title says so and save also sends (Koh 21:0x).
import { el } from "../../js/zk_dom.js";
import { icon } from "../../js/zk_reqicons.js";

function iconButton(cls, name, tip, onClick) {
  const b = el("button", { className: "zk-req-btn " + cls, attrs: { type: "button", "data-tip": tip,
    "aria-label": tip }, on: { click: onClick } });
  b.innerHTML = icon(name);
  return b;
}

function makeFoot(ctx, ui, onDelete) {
  const masked = el("span", { className: "zk-api-masked" });
  const getKey = el("button", { className: "zk-api-getkey", attrs: { type: "button" }, on: { click: function () {
    globalThis.open(ctx.cfg.ai.links.keys, "_blank", "noopener");
  } } });
  getKey.innerHTML = icon("ext");
  getKey.append(el("span", { text: ui.getKey }));
  const text = el("div", { className: "zk-api-foottext" });
  text.append(masked, el("span", { className: "zk-api-here", text: ui.keyHere }), getKey);
  const trash = iconButton("zk-api-delete", "trash", ctx.k.ui.apiTips.delete, onDelete);
  const foot = el("div", { className: "zk-api-foot" });
  foot.append(text, trash);
  function show(value) {
    masked.textContent = value || "";
    masked.hidden = !value;
    trash.hidden = !value;
    getKey.hidden = !!value;
  }
  return { foot, show };
}

export function makeKeyPanel(ctx, parts) {
  const ui = ctx.k.ui.api;
  const tips = ctx.k.ui.apiTips;
  const node = el("div", { className: "zk-api-keypanel zk-api-pop", attrs: { role: "dialog", "aria-label": tips.key } });
  const title = el("span", { className: "zk-api-title", text: ui.keyTitle });
  const head = el("div", { className: "zk-api-head" });
  const input = el("input", { className: "zk-api-keyinput", attrs: { type: "password", placeholder: ui.keyPlaceholder,
    autocomplete: "off", spellcheck: "false" } });
  let mode = "key";

  function ready() {
    saveBtn.classList.toggle("zk-api-ready", input.value.trim() !== "");
  }

  // Closed without saving in "no key yet" mode: the words waiting for the key are dropped (review 2026-11-25).
  function close() {
    if (!node.hidden && mode === "nokey") {
      parts.ai.forget();
    }
    mode = "key";
    node.hidden = true;
    input.value = "";
    input.setAttribute("type", "password");
    ready();
  }

  function open(how) {
    mode = how || "key";
    node.classList.toggle("zk-api-nokey", mode === "nokey");
    head.classList.toggle("zk-api-warnhead", mode === "nokey");
    title.textContent = mode === "nokey" ? ui.noKeyTitle : ui.keyTitle;
    foot.show(parts.models.masked());
    node.hidden = false;
    if (input.focus) {
      input.focus();
    }
  }

  async function save() {
    const value = input.value.trim();
    if (!value) {
      return;
    }
    input.value = "";
    const sending = mode === "nokey";
    mode = "key";
    const saved = await parts.models.setKey(value);
    close();
    if (sending && saved !== false) {
      await parts.ai.resume();
    }
  }

  const saveBtn = iconButton("zk-api-save", "check", tips.save, save);
  const foot = makeFoot(ctx, ui, function () {
    parts.models.clearKey();
    foot.show("");
  });
  const eye = iconButton("zk-api-eye", "eye", tips.show, function () {
    input.setAttribute("type", input.getAttribute("type") === "password" ? "text" : "password");
  });
  const field = el("div", { className: "zk-api-field" });
  field.append(input, eye);
  const row = el("div", { className: "zk-api-row" });
  row.append(field, saveBtn);
  head.append(title, iconButton("zk-api-close", "close", tips.close, close));
  node.append(head, row, foot.foot);
  input.addEventListener("input", ready);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      return save();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    return null;
  });
  node.hidden = true;
  return { node, open, close };
}
