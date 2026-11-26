// LOGICAL: the page bus; components listen here, never in each other's DOM (event list: docs/zk_api.js.md).
// zk:pov, zk:pose, zk:pen {tool}, zk:color, zk:picker {open}, zk:request {sent} or {answers, unseen}, zk:compare {open};
// zk:ai, zk:aierr, zk:needkey, zk:models (Claude API); zk:mode {mode, source}, zk:source {still}, zk:fps {value}.
export const EVENTS = { pov: "zk:pov", pose: "zk:pose", pen: "zk:pen", color: "zk:color", picker: "zk:picker",
  request: "zk:request", compare: "zk:compare", ai: "zk:ai", aiErr: "zk:aierr", needKey: "zk:needkey", models: "zk:models", mode: "zk:mode", source: "zk:source",
  fps: "zk:fps" };

export function createBus() {
  const target = new EventTarget();
  return {
    on: function (name, fn) {
      target.addEventListener(name, function (e) {
        fn(e.detail);
      });
    },
    emit: function (name, detail) {
      target.dispatchEvent(new CustomEvent(name, { detail }));
    },
  };
}
