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

function makeElement(tag) {
  const el = {
    tag, textContent: "", className: "", value: "", placeholder: "", checked: false, paused: true,
    width: 0, height: 0, videoWidth: 0, videoHeight: 0, readyState: 0, style: {}, dataset: {}, options: [], children: [],
  };
  el.appendChild = function (child) {
    el.children.push(child);
    if (child.tag === "option") {
      el.options.push(child);
    }
  };
  el.addEventListener = function () {
    return null;
  };
  el.removeEventListener = el.addEventListener;
  el.pause = el.addEventListener;
  el.getContext = function () {
    return { clearRect: el.addEventListener };
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

function byAttribute(nodes, selector) {
  const key = selector.slice(6, -1);
  return nodes.filter(function (n) {
    return n.dataset[key] !== undefined;
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
