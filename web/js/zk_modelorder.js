// LOGICAL (pure): the model list of the key bar (Koh voice 2026-11-26 ~00:0x): names without the "Claude " prefix, the
// newest model of each family on top in cfg.modelOrder (Fable, Opus, Sonnet, Haiku), then the older ones (the bar
// draws a divider between the groups), same family order, newest first; unknown families last. Ids are unchanged.
function family(name, order) {
  const low = name.toLowerCase();
  const i = order.findIndex((f) => low.includes(f));
  return i < 0 ? order.length : i;
}

function version(name) {
  const m = name.match(/(\d+)(?:\.(\d+))?/);
  return m ? Number(m[1]) * 1000 + Number(m[2] || 0) : -1;
}

export function arrangeModels(list, cfg) {
  const order = cfg.modelOrder || [];
  const prefix = cfg.modelPrefix || "";
  const rows = (list || []).map((m, i) => ({ id: m.id, name: m.name.startsWith(prefix) ? m.name.slice(prefix.length) : m.name,
    fam: family(m.name, order), ver: version(m.name), i }));
  rows.sort((a, b) => a.fam - b.fam || b.ver - a.ver || a.i - b.i);
  const top = new Set();
  return rows.map(function (r) {
    const fresh = r.fam < order.length && !top.has(r.fam);
    if (fresh) {
      top.add(r.fam);
    }
    return { id: r.id, name: r.name, group: fresh ? "new" : "old" };
  }).sort((a, b) => (a.group === b.group ? 0 : a.group === "new" ? -1 : 1));
}
