// COMPONENT povpanel - field builders: a labelled slider with a number box, a button group, a checkbox, a number
// box and a select. Each returns { node, set(value) }; the panel calls set() when the POV settings change.
import { el, button, pressed, setValue } from "../../js/zk_dom.js";

export function slider(label, range, onValue) {
  const [min, max, step] = range;
  const attrs = { min, max, step };
  const read = function (e) {
    onValue(Number(e.target.value));
  };
  const range0 = el("input", { className: "zk-slider", attrs: { type: "range", ...attrs }, on: { input: read } });
  const box = el("input", { className: "zk-num", attrs: { type: "number", ...attrs }, on: { change: read } });
  const node = el("div", { className: "zk-row zk-slider-row" });
  const head = el("div", { className: "zk-slider-head" });
  head.append(el("span", { text: label }), box);
  const ends = el("div", { className: "zk-slider-ends" });
  ends.append(el("span", { text: String(min) }), el("span", { text: String(max) }));
  node.append(head, range0, ends);
  return { node, set: function (v) {
    setValue(range0, v);
    setValue(box, v);
  } };
}

export function group(label, items, onPick) {
  const node = el("div", { className: "zk-row zk-group" });
  if (label) {
    node.append(el("span", { className: "zk-group-label", text: label }));
  }
  const buttons = items.map(function (item) {
    const b = button(item.text, function () {
      onPick(item.key);
    }, "zk-choice");
    node.append(b);
    return b;
  });
  return { node, set: function (key) {
    buttons.forEach(function (b, i) {
      pressed(b, items[i].key === key);
    });
  }, show: function (key, on) {
    buttons.forEach(function (b, i) {
      if (items[i].key === key) {
        b.hidden = !on;
      }
    });
  } };
}

export function check(label, onValue) {
  const input = el("input", { attrs: { type: "checkbox" }, on: { change: function (e) {
    onValue(e.target.checked);
  } } });
  const node = el("label", { className: "zk-check" });
  node.append(input, el("span", { text: label }));
  return { node, set: function (v) {
    input.checked = !!v;
  } };
}

export function number(attrs, onValue) {
  const node = el("input", { className: "zk-num", attrs: { type: "number", ...attrs }, on: { change: function (e) {
    onValue(Number(e.target.value));
  } } });
  return { node, set: function (v) {
    setValue(node, v);
  } };
}

export function select(items, onPick) {
  const node = el("select", { className: "zk-select", on: { change: function (e) {
    onPick(e.target.value);
  } } });
  for (const item of items) {
    const opt = el("option", { text: item.text });
    opt.value = item.key;
    node.appendChild(opt);
  }
  return { node, set: function (v) {
    node.value = v;
  } };
}
