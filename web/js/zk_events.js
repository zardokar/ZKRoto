// LOGICAL: the page's event bus. Components never reach into each other's DOM; they listen here instead.
// zk:pov = POV settings changed (view, person, camera, output, layers, names); zk:pose = pose of the frame changed.
export const EVENTS = { pov: "zk:pov", pose: "zk:pose" };

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
