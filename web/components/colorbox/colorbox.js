// COMPONENT colorbox: the Fill / Stroke box at the foot of the tool bar (canvas.html #cvColorBox, cv_color.js):
// stroke = hollow ring, fill = solid square, the front one outlined; a click = front + open the picker; swap (X)
// and no colour (/). Talks to the pen only through parts.pen.color; the picker is opened through the bus.
import { EVENTS } from "../../js/zk_events.js";
import { el } from "../../js/zk_dom.js";

const SWAP_SVG = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 4H10M8 2L10 4L8 6M11 8H2M4 6L2 8L4 10"></path></svg>';

function boxButton(className, tip, onClick) {
  return el("button", { className, attrs: { type: "button", "data-tip": tip, "aria-label": tip },
    on: { click: onClick } });
}

// Fill paints the square, stroke paints the edge and stays hollow (Koh: like Illustrator, docs/cv_color.js.md).
function paint(node, value, front, ring) {
  const none = !value || value === "none";
  node.style.backgroundColor = ring || none ? "transparent" : value;
  node.style.borderColor = ring && !none ? value : "";
  node.classList.toggle("zk-none", none);
  node.classList.toggle("zk-front", !!front);
}

export function mount(host, ctx, parts) {
  const { k, bus } = ctx;
  const color = parts.pen.color;
  const t = k.ui.color;
  function open(which) {
    color.front(which);
    bus.emit(EVENTS.picker, { open: true });
  }
  const stroke = boxButton("zk-cbox zk-cbox-stroke", t.strokeTip, function () {
    open("stroke");
  });
  const fill = boxButton("zk-cbox zk-cbox-fill", t.fillTip, function () {
    open("fill");
  });
  const swap = boxButton("zk-cmini zk-cswap", t.swap, function () {
    color.swap();
  });
  swap.innerHTML = SWAP_SVG;
  const none = boxButton("zk-cmini zk-cnone", t.none, function () {
    color.apply("none");
  });
  function render(s) {
    paint(fill, s.fill, s.front === "fill", false);
    paint(stroke, s.stroke, s.front === "stroke", true);
  }
  host.append(stroke, fill, swap, none);
  bus.on(EVENTS.color, render);
  render(color.style());
}
