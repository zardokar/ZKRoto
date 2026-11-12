// LAYOUT (the one place that decides where components sit): config.layout.slots names the components of each
// page slot ([data-slot]); config.layout.tabs which panel components belong to which tab. Each component gets its
// own host element and its own CSS file (components/<name>/<name>.css?v=<version>).
import { EVENTS } from "./zk_events.js";

const HOST_CLASS = "zk-host";

function loadCss(doc, name, version) {
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = `components/${name}/${name}.css?v=${version}`;
  doc.head.appendChild(link);
}

function showTab(hosts, tabs, tab) {
  for (const [name, members] of Object.entries(tabs)) {
    for (const member of members) {
      if (hosts[member]) {
        hosts[member].hidden = name !== tab;
      }
    }
  }
}

export function mountLayout(ctx, api, registry, doc) {
  const { cfg, k, bus } = ctx;
  const hosts = {};
  for (const [slot, names] of Object.entries(cfg.layout.slots)) {
    const place = doc.querySelector(`[data-slot="${slot}"]`);
    for (const name of names) {
      const host = doc.createElement("div");
      host.className = HOST_CLASS;
      host.dataset.component = name;
      place.appendChild(host);
      loadCss(doc, name, k.version);
      registry[name](host, ctx, api);
      hosts[name] = host;
    }
  }
  const apply = function (pov) {
    doc.body.dataset.view = pov.view;
    showTab(hosts, cfg.layout.tabs, pov.tab);
  };
  bus.on(EVENTS.pov, apply);
  apply(ctx.state.pov);
  return hosts;
}
