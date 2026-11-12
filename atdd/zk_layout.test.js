// Re-skinnable page (design doc 1.11): one folder per component with its own JS + CSS, one theme file of CSS
// variables, one layout place (config.layout), components never import each other.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const WEB = path.join(__dirname, "..", "web");
const COMP = path.join(WEB, "components");
const CFG = JSON.parse(fs.readFileSync(path.join(WEB, "config", "zkroto.json"), "utf8"));
const K = JSON.parse(fs.readFileSync(path.join(WEB, "constants", "zkroto.json"), "utf8"));
const HARD_COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
const IMPORT = /^import .* from "([^"]+)";$/gm;

function folders() {
  return fs.readdirSync(COMP, { withFileTypes: true }).filter(function (e) {
    return e.isDirectory();
  }).map(function (e) {
    return e.name;
  }).sort();
}

function registryNames() {
  const src = fs.readFileSync(path.join(COMP, "registry.js"), "utf8");
  return [...src.matchAll(/import \{ mount as (\w+) \} from "\.\/(\w+)\/(\w+)\.js";/g)].map(function (m) {
    assert.strictEqual(m[1], m[2]);
    assert.strictEqual(m[2], m[3]);
    return m[1];
  }).sort();
}

test("every component folder has <name>.js and <name>.css and is in the registry", function () {
  assert.deepStrictEqual(registryNames(), folders());
  for (const name of folders()) {
    assert.ok(fs.existsSync(path.join(COMP, name, `${name}.js`)), `${name}.js`);
    assert.ok(fs.existsSync(path.join(COMP, name, `${name}.css`)), `${name}.css`);
  }
});

test("config.layout places every component exactly once; tabs name only panel components", function () {
  const placed = Object.values(CFG.layout.slots).flat().sort();
  assert.deepStrictEqual(placed, folders());
  const tabbed = Object.values(CFG.layout.tabs).flat();
  for (const name of tabbed) {
    assert.ok(CFG.layout.slots.panel.includes(name), name);
  }
  assert.ok(CFG.layout.tab in CFG.layout.tabs);
});

test("colours only in the theme file: no hard colour in the page layout or any component CSS", function () {
  const files = [path.join(WEB, "layout", "zk_page.css")].concat(folders().map(function (n) {
    return path.join(COMP, n, `${n}.css`);
  }));
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    assert.strictEqual(HARD_COLOUR.test(text), false, f);
  }
});

test("the theme's person colours are the canvas colours of constants (one look for buttons and drawings)", function () {
  const theme = fs.readFileSync(path.join(WEB, "theme", "zk_theme.css"), "utf8");
  K.colors.people.forEach(function (c, i) {
    assert.match(theme, new RegExp(`--zk-person-${i + 1}: ${c};`));
  });
});

test("components import only logic / helpers from web/js and their own folder, never another component", function () {
  for (const name of folders()) {
    for (const f of fs.readdirSync(path.join(COMP, name)).filter(function (x) {
      return x.endsWith(".js");
    })) {
      const src = fs.readFileSync(path.join(COMP, name, f), "utf8");
      for (const m of src.matchAll(IMPORT)) {
        assert.ok(m[1].startsWith("../../js/") || m[1].startsWith("./"), `${name}/${f}: ${m[1]}`);
      }
    }
  }
});

test("logic modules know nothing of the DOM (headless): no document / window / element access", function () {
  const logic = ["zk_openpose", "zk_camera", "zk_framing", "zk_outsize", "zk_naming", "zk_posejson", "zk_sheetlayout",
    "zk_povstate", "zk_pov", "zk_skeleton", "zk_events", "zk_facecrop", "zk_openface", "zk_facefit"];
  for (const name of logic) {
    const src = fs.readFileSync(path.join(WEB, "js", `${name}.js`), "utf8");
    assert.strictEqual(/\b(document|window|HTMLElement|querySelector)\b/.test(src), false, name);
  }
});
