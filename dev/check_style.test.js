// Proves the checker goes RED on each planted violation and GREEN on a clean file (coder §4b).
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const checker = require("./check_style");

function tmpFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "imgbuff-cs-"));
  const full = path.join(dir, name);
  fs.writeFileSync(full, content);
  return full;
}

function findingsFor(name, content) {
  const findings = [];
  checker.checkFile(tmpFile(name, content), findings);
  return findings;
}

test("clean js file passes", function () {
  const src = "// ok\n\"use strict\";\n\nfunction a() {\n  return 1;\n}\n\nmodule.exports = { a };\n";
  assert.deepEqual(findingsFor("ok.js", src), []);
});

test("RED: file over 200 lines", function () {
  const src = Array.from({ length: 201 }, function (_v, i) {
    return `const x${i} = ${i};`;
  }).join("\n") + "\n";
  const f = findingsFor("long.js", src);
  assert.equal(f.length, 1);
  assert.match(f[0], /201 lines/);
});

test("RED: one-line function body (function and arrow)", function () {
  const ob = String.fromCharCode(123);
  const cb = String.fromCharCode(125);
  const planted = `function a() ${ob} return 1; ${cb}\nconst b = () => ${ob} return 2; ${cb};\n`;
  const f = findingsFor("one.js", planted);
  assert.equal(f.length, 2);
  assert.match(f[0], /:1 one-line/);
  assert.match(f[1], /:2 one-line/);
});

test("destructured params are not a one-liner", function () {
  assert.deepEqual(findingsFor("ds.js", "function boot({ a, b }) {\n  return a + b;\n}\n"), []);
});

test("RED: comment block longer than 3 lines", function () {
  const f = findingsFor("c.js", "// 1\n// 2\n// 3\n// 4\nconst a = 1;\n");
  assert.equal(f.length, 1);
  assert.match(f[0], /comment block of 4/);
});

test("RED: CRLF in a .js file, LF in a .css file", function () {
  assert.match(findingsFor("e.js", "const a = 1;\r\n")[0], /expected LF/);
  assert.match(findingsFor("e.css", "a { color: red; }\n")[0], /expected CRLF/);
});

test("RED: sibling module import", function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "imgbuff-cs-"));
  const file = path.join(dir, "module", "alpha", "main", "x.js");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "const y = require(\"../../beta/main/y.js\");\nconst z = require(\"../../../core/io\");\n");
  const findings = [];
  checker.checkFile(file, findings);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /sibling module "beta"/);
});

test("RED: disallowed dependency in package.json", function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "imgbuff-cs-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ devDependencies: { electron: "1", lodash: "1" } }));
  const f = checker.run([dir]);
  assert.equal(f.length, 1);
  assert.match(f[0], /"lodash" is not allowed/);
});
