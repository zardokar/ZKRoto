// Test helper for the pen facade tests: a pen canvas shown at half its pixel size and pointer events in box pixels.
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const WEB = path.join(__dirname, "..", "web");
const CFG = JSON.parse(fs.readFileSync(path.join(WEB, "config", "zkroto.json"), "utf8"));
const K = JSON.parse(fs.readFileSync(path.join(WEB, "constants", "zkroto.json"), "utf8"));

function mod(name) {
  return import(pathToFileURL(path.join(WEB, "js", name)).href);
}

// A canvas shown at half its pixel size: 800 x 600 pixels in a 400 x 300 box.
function fakeCanvas() {
  const classes = new Set();
  return {
    width: 800, height: 600, captured: [], style: {}, box: { left: 10, top: 20, width: 400, height: 300 },
    classList: { toggle: function (n, on) {
      if (on) {
        classes.add(n);
      } else {
        classes.delete(n);
      }
    }, has: function (n) {
      return classes.has(n);
    } },
    getBoundingClientRect: function () {
      return this.box;
    },
    getContext: function () {
      return new Proxy({}, { get: function () {
        return function () {
          return null;
        };
      }, set: function () {
        return true;
      } });
    },
    setPointerCapture: function (id) {
      this.captured.push(id);
    },
  };
}

async function setup() {
  const { createBus, EVENTS } = await mod("zk_events.js");
  const { createPen } = await mod("zk_pen.js");
  const canvas = fakeCanvas();
  const calls = [];
  const watch = [];
  const view = { onChange: function (fn) {
    watch.push(fn);
  }, changed: function () {
    watch.forEach(function (fn) {
      fn();
    });
  }, zoomAtClient: function (x, y, f) {
    calls.push(["zoom", x, y, f]);
  }, panBy: function (dx, dy) {
    calls.push(["pan", dx, dy]);
  }, fit: function () {
    calls.push(["fit"]);
  }, sample: function (x, y) {
    calls.push(["sample", x, y]);
    return "#123456";
  } };
  const ctx = { cfg: CFG, k: K, el: { pen: canvas }, state: { editMode: false }, bus: createBus(), log: function () {
    return null;
  }, t: function () {
    return "";
  } };
  const seen = [];
  ctx.bus.on(EVENTS.pen, function (d) {
    seen.push(d.tool);
  });
  return { pen: createPen(ctx, view), canvas, seen, calls, view, ctx };
}

// Screen point (box coordinates) -> pointer event.
function ev(x, y, more) {
  return { clientX: 10 + x, clientY: 20 + y, pointerId: 1, button: 0, isPrimary: true, preventDefault: function () {
    return null;
  }, ...more };
}

// Keyboard event on the page body.
function key(code, more) {
  return { code, key: code, target: { tagName: "BODY" }, preventDefault: function () {
    return null;
  }, ...more };
}

module.exports = { CFG, setup, ev, key };
