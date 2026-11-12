// One version everywhere, and every page module and JSON file loaded with ?v=<version> (import map in index.html).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WEB = path.join(ROOT, "web");
const MAP = /<script type="importmap">([\s\S]*?)<\/script>/;
const ENTRY = /<script type="module" src="js\/zk_main\.js\?v=([\d.]+)"><\/script>/;

function read(...p) {
  return fs.readFileSync(path.join(...p), "utf8");
}

function version() {
  return JSON.parse(read(WEB, "constants", "zkroto.json")).version;
}

const JSON_IMPORT = /from "([^"]+\.json)" with \{ type: "json" \}/g;

// Every .js under web/js and web/components (any depth) plus every JSON file any of them imports, as "./<path>".
function wanted() {
  const out = new Set();
  const walk = function (dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p);
      } else if (p.endsWith(".js")) {
        out.add("./" + path.relative(WEB, p).split(path.sep).join("/"));
        for (const m of fs.readFileSync(p, "utf8").matchAll(JSON_IMPORT)) {
          out.add("./" + path.relative(WEB, path.join(path.dirname(p), m[1])).split(path.sep).join("/"));
        }
      }
    }
  };
  walk(path.join(WEB, "js"));
  walk(path.join(WEB, "components"));
  return [...out].sort();
}

const CSS_LINK = /<link rel="stylesheet" href="([^"?]+)\?v=([\d.]+)">/g;

test("index.html loads the theme and the page layout CSS with ?v=<version>", function () {
  const links = [...read(WEB, "index.html").matchAll(CSS_LINK)];
  assert.deepStrictEqual(links.map(function (m) {
    return m[1];
  }), ["theme/zk_theme.css", "layout/zk_page.css"]);
  for (const m of links) {
    assert.strictEqual(m[2], version(), m[1]);
    assert.ok(fs.existsSync(path.join(WEB, m[1])), m[1]);
  }
});

test("import map covers every page module and both JSON files, each with ?v=<version>", function () {
  const m = read(WEB, "index.html").match(MAP);
  assert.ok(m, "no import map in index.html");
  const imports = JSON.parse(m[1]).imports;
  assert.deepStrictEqual(Object.keys(imports).sort(), wanted());
  for (const [k, v] of Object.entries(imports)) {
    assert.strictEqual(v, `${k}?v=${version()}`, k);
  }
});

test("entry script, __init__.py and README carry the same version as constants", function () {
  const v = version();
  assert.strictEqual(read(WEB, "index.html").match(ENTRY)[1], v);
  assert.strictEqual(read(ROOT, "__init__.py").match(/^VERSION = "([\d.]+)"$/m)[1], v);
  assert.strictEqual(read(ROOT, "README.md").match(/^# ZKRoto ([\d.]+)$/m)[1], v);
});
