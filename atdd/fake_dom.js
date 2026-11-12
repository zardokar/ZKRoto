// Test helper: a tiny fake DOM built from web/index.html (ids, data-* keys), enough to run zk_main.js in Node.
"use strict";
const fs = require("fs");
const path = require("path");

const HTML = path.join(__dirname, "..", "web", "index.html");
const TAG = /<(\w+)([^>]*)>/g;
const ATTR = /([\w-]+)(?:="([^"]*)")?/g;
const DASH_LETTER = /-(\w)/g;

function camel(name) {
  return name.replace(DASH_LETTER, function (_m, c) {
    return c.toUpperCase();
  });
}

// A 2D context whose every method does nothing (drawing is tested elsewhere with a recording context).
const NO_OP_CONTEXT = new Proxy({}, {
  get: function () {
    return function () {
      return null;
    };
  },
  set: function () {
    return true;
  },
});

function classList(el) {
  const names = new Set();
  return {
    add: function (n) {
      names.add(n);
    },
    remove: function (n) {
      names.delete(n);
    },
    toggle: function (n, on) {
      if (on === undefined ? !names.has(n) : on) {
        names.add(n);
      } else {
        names.delete(n);
      }
      el.classNames = [...names];
    },
    contains: function (n) {
      return names.has(n);
    },
  };
}

function makeElement(tag) {
  const el = {
    tag, textContent: "", className: "", value: "", placeholder: "", checked: false, paused: true, hidden: false,
    width: 0, height: 0, videoWidth: 0, videoHeight: 0, readyState: 0, style: {}, dataset: {}, options: [], children: [],
    attributes: {}, listeners: {},
  };
  el.classList = classList(el);
  el.appendChild = function (child) {
    el.children.push(child);
    if (child.tag === "option") {
      el.options.push(child);
    }
    return child;
  };
  el.append = function (...nodes) {
    nodes.forEach(el.appendChild);
  };
  el.setAttribute = function (name, value) {
    el.attributes[name] = String(value);
  };
  el.getAttribute = function (name) {
    return name in el.attributes ? el.attributes[name] : null;
  };
  el.addEventListener = function (name, fn) {
    (el.listeners[name] = el.listeners[name] || []).push(fn);
  };
  el.removeEventListener = function () {
    return null;
  };
  el.pause = el.removeEventListener;
  el.setPointerCapture = el.removeEventListener;
  el.getContext = function () {
    return NO_OP_CONTEXT;
  };
  return el;
}

function attributes(text) {
  const out = {};
  for (const m of text.matchAll(ATTR)) {
    out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

function fromHtml() {
  const nodes = [];
  for (const m of fs.readFileSync(HTML, "utf8").matchAll(TAG)) {
    const a = attributes(m[2]);
    const el = makeElement(m[1].toLowerCase());
    el.id = a.id || "";
    el.checked = a.checked === true;
    for (const [k, v] of Object.entries(a)) {
      if (k.startsWith("data-")) {
        el.dataset[camel(k.slice(5))] = v;
      }
    }
    nodes.push(el);
  }
  return nodes;
}

const DATA_SELECTOR = /^\[data-([\w-]+)(?:="([^"]*)")?\]$/;

// Only the selectors the page uses: [data-key] and [data-key="value"].
function byAttribute(nodes, selector) {
  const m = selector.match(DATA_SELECTOR);
  const key = camel(m[1]);
  return nodes.filter(function (n) {
    return n.dataset[key] !== undefined && (m[2] === undefined || n.dataset[key] === m[2]);
  });
}

// Install document, window, location and a fetch that never answers as globals; return the nodes.
function install() {
  const nodes = fromHtml();
  globalThis.document = {
    getElementById: function (id) {
      return nodes.find(function (n) {
        return n.id === id;
      }) || null;
    },
    querySelectorAll: function (selector) {
      return byAttribute(nodes, selector);
    },
    querySelector: function (selector) {
      return byAttribute(nodes, selector)[0] || null;
    },
    head: makeElement("head"),
    body: makeElement("body"),
    activeElement: null,
    createElement: makeElement,
    addEventListener: function () {
      return null;
    },
  };
  globalThis.window = globalThis;
  globalThis.location = { pathname: "/zkroto/index.html", search: "" };
  globalThis.fetch = function () {
    return new Promise(function () {
      return null;
    });
  };
  return nodes;
}

module.exports = { install };
