// VIEW HELPERS for components: make elements with text, class, attributes and handlers (no layout, no style).
export function el(tag, opts) {
  const o = opts || {};
  const node = document.createElement(tag);
  if (o.className) {
    node.className = o.className;
  }
  if (o.text !== undefined) {
    node.textContent = o.text;
  }
  for (const [key, value] of Object.entries(o.attrs || {})) {
    node.setAttribute(key, String(value));
  }
  for (const [key, fn] of Object.entries(o.on || {})) {
    node.addEventListener(key, fn);
  }
  return node;
}

export function button(text, onClick, className) {
  return el("button", { text, className, attrs: { type: "button" }, on: { click: onClick } });
}

export function pressed(node, on) {
  node.setAttribute("aria-pressed", String(!!on));
}

// Set an input's value unless the user is typing in it right now.
export function setValue(input, value) {
  if (document.activeElement !== input) {
    input.value = String(value);
  }
}
