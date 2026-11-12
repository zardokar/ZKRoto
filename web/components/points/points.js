// COMPONENT points (Points tab): the 33 MediaPipe points of the shown frame - source pixels, POV pixels, visibility.
import { EVENTS } from "../../js/zk_events.js";
import { el } from "../../js/zk_dom.js";

const COLUMNS = ["pointIndex", "pointName", "srcX", "srcY", "povX", "povY", "pointVis"];
const PX = 1;
const VIS = 2;
const NONE = "-";

export function mount(host, ctx, parts) {
  const { k, bus } = ctx;
  const table = el("table", { className: "zk-points" });
  const head = el("tr");
  for (const c of COLUMNS) {
    head.append(el("th", { text: k.ui[c] }));
  }
  table.append(head);
  const cells = k.mpNames.map(function (name, i) {
    const row = el("tr");
    const out = COLUMNS.map(function () {
      const td = el("td");
      row.append(td);
      return td;
    });
    out[0].textContent = String(i);
    out[1].textContent = name;
    table.append(row);
    return out;
  });
  host.append(table);

  function update() {
    const pts = parts.pov.points();
    cells.forEach(function (row, i) {
      const s = pts ? pts.src.mp[i] : null;
      const p = pts ? pts.pov.mp[i] : null;
      row[2].textContent = s ? s[0].toFixed(PX) : NONE;
      row[3].textContent = s ? s[1].toFixed(PX) : NONE;
      row[4].textContent = p && p[2] > 0 ? p[0].toFixed(PX) : NONE;
      row[5].textContent = p && p[2] > 0 ? p[1].toFixed(PX) : NONE;
      row[6].textContent = s ? s[2].toFixed(VIS) : NONE;
    });
  }
  bus.on(EVENTS.pov, update);
  bus.on(EVENTS.pose, update);
  update();
}
