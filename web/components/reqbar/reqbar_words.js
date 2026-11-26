// COMPONENT part of reqbar: the word box under the plane (wf_zkapi_3 B, X added on Koh's word 2026-11-25 21:0x).
// The main input of the flow: Enter sends the words through parts.ai (Claude picks the recipe); Esc or X closes.
import { el } from "../../js/zk_dom.js";
import { icon } from "../../js/zk_reqicons.js";

function iconButton(cls, name, tip, onClick) {
  const b = el("button", { className: "zk-req-btn zk-req-wbtn " + cls, attrs: { type: "button", "data-tip": tip,
    "aria-label": tip }, on: { click: onClick } });
  b.innerHTML = icon(name);
  return b;
}

export function makeWords(ctx, parts) {
  const tips = ctx.k.ui.reqTips;
  const node = el("div", { className: "zk-req-words", attrs: { role: "dialog", "aria-label": tips.words } });
  const input = el("input", { className: "zk-req-winput", attrs: { type: "text", placeholder: tips.wordsPlaceholder,
    "aria-label": tips.words, spellcheck: "false" } });

  function close() {
    node.hidden = true;
  }

  function open() {
    node.hidden = false;
    if (input.focus) {
      input.focus();
    }
  }

  async function submit() {
    const words = input.value.trim();
    if (!words) {
      return null;
    }
    close();
    return parts.ai.send(words);
  }

  input.addEventListener("keydown", function (e) {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      return submit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    return null;
  });
  node.append(input, iconButton("zk-req-wsend", "send", tips.send, submit),
    iconButton("zk-req-wclose", "close", tips.close, close));
  node.hidden = true;
  return { node, open, close };
}
