// LOGICAL (pure): the canvas module's key table (cv_key_edit.js, cv_key_menu.js, cv_key_common.js; docs/cv_keys.js.md)
// for the tools ZKRoto has. Keys by e.code = the key's place (Thai layout), e.key only as a fallback; silent while
// typing. st = { tool, drawing, selected }.
import { TOOLS } from "./zk_pentools.js";

const FIELD_TAGS = ["INPUT", "TEXTAREA", "SELECT"];
const NAMED = { Space: " ", Slash: "/", Enter: "enter", NumpadEnter: "enter", Escape: "escape", Delete: "delete",
  Backspace: "backspace" };
// No e.code (some keyboards / remote desktops): the Thai Kedmanee letter of the same key place.
const THAI = { "อ": "v", "ฟ": "a", "ย": "p", "ผ": "z", "ร": "i", "ป": "x", "ฝ": "/", "จ": "0" };

// cvKeyInField: input (any type), textarea, select, contenteditable.
export function inField(target) {
  if (!target || !target.tagName) {
    return false;
  }
  return FIELD_TAGS.includes(String(target.tagName).toUpperCase()) || !!target.isContentEditable;
}

// cvKeyName: "KeyV" -> "v", "Digit0" -> "0", named keys; no code -> e.key.
export function keyName(e) {
  const code = String(e.code || "");
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice(3).toLowerCase();
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice(5);
  }
  if (NAMED[code]) {
    return NAMED[code];
  }
  const ch = String(e.key || "");
  return THAI[ch] || ch.toLowerCase();
}

// cvKeyMenuAction for the pen: Ctrl+Z one point back while drawing, Ctrl+Y / Ctrl+Shift+Z forward (cvHistStep).
// While a line is open Ctrl+Z steps back one point (cvPenStep), else it is the history (cvHistStep).
function menuAction(key, e, st) {
  const kind = st.drawing ? "step" : "undo";
  if (key === "z") {
    return { kind, back: !e.shiftKey };
  }
  if (key === "y") {
    return { kind, back: false };
  }
  return null;
}

function toolOf(key) {
  const hit = Object.entries(TOOLS).find(function (entry) {
    return entry[1] === "Key" + key.toUpperCase();
  });
  return hit ? hit[0] : null;
}

// cvKeyEditAction + cvKeyEscape / cvKeyDelete / cvPenDone as far as they have a meaning here.
function editAction(key, st) {
  if (key === "delete" || key === "backspace") {
    return st.selected ? { kind: "delete" } : null;
  }
  if (key === "escape") {
    if (st.transforming) {
      return { kind: "untransform" };
    }
    if (st.drawing) {
      return { kind: "cancel" };
    }
    return { kind: "deselect" };
  }
  if (key === "enter") {
    return st.drawing ? { kind: "finish" } : null;
  }
  if (key === "0") {
    return { kind: "fit" };
  }
  if (key === "x") {
    return { kind: "swap" };
  }
  if (key === "/") {
    return { kind: "none" };
  }
  if (key === " ") {
    return { kind: "mod", name: "pan" };
  }
  const tool = key.length === 1 ? toolOf(key) : null;
  return tool ? { kind: "tool", name: tool } : null;
}

export function penKey(e, st) {
  if (inField(e.target)) {
    return null;
  }
  const key = keyName(e);
  if (e.ctrlKey || e.metaKey) {
    return menuAction(key, e, st);
  }
  return editAction(key, st);
}
