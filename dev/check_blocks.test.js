// check_blocks.js — the block check beside check_style.js (coder §3b): a block with statements on one line, or two statements
// on one line, outside strings, templates, regex literals and comments. RED on each planted case, GREEN on clean code.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const blocks = require("./check_blocks.js");

const OB = String.fromCharCode(123);
const CB = String.fromCharCode(125);

function lines(list) {
  return list.join("\n") + "\n";
}

function found(src) {
  return blocks.scan(src).map(function (f) {
    return f.line + " " + f.why;
  });
}

test("clean code passes: blocks over lines, object literals, for (;;), strings and regex literals holding braces or semicolons", function () {
  const src = lines([
    `function a(x) ${OB}`,
    `  const o = ${OB} k: 1, s: "a; ${OB} b ${CB}" ${CB};`,
    "  const r = /[\";,]|^\\s/;",
    `  for (let i = 0; i < 2; i += 1) ${OB}`,
    "    x += i;",
    `  ${CB}`,
    "  // a; b; { c; }",
    `  return \`$${OB}o.k${CB}; ${OB} ;\`;`,
    CB
  ]);
  assert.deepStrictEqual(found(src), []);
});

test("RED: a function body on one line (function, arrow, nested in a call)", function () {
  const src = lines([
    `function a() ${OB} return 1; ${CB}`,
    `const b = () => ${OB} return 2; ${CB};`,
    `list.forEach(function (x) ${OB} use(x); ${CB});`
  ]);
  assert.deepStrictEqual(found(src), ["1 block on one line", "2 block on one line", "3 block on one line"]);
});

test("RED: an if / try block on one line", function () {
  const src = lines([
    `if (x) ${OB} y(); ${CB}`,
    `try ${OB} z(); ${CB} catch (e) ${OB} w(); ${CB}`
  ]);
  assert.deepStrictEqual(found(src), ["1 block on one line", "2 block on one line", "2 block on one line"]);
});

test("RED: a one-line function inside a template expression is found; the template text itself is not code", function () {
  const src = lines([
    `const t = \`a; $${OB}xs.map(function (x) ${OB} return x; ${CB})${CB} b;\`;`
  ]);
  assert.deepStrictEqual(found(src), ["1 block on one line"]);
});

test("RED: two statements on one line", function () {
  assert.deepStrictEqual(found(lines(["a(); b();"])), ["1 statements on one line"]);
});

test("run(targets) walks .js files and prints file:line; a missing target is an error", function () {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zpls-cb-"));
  fs.writeFileSync(path.join(dir, "ok.js"), lines(["const a = 1;"]));
  fs.writeFileSync(path.join(dir, "bad.js"), lines(["a(); b();"]));
  fs.writeFileSync(path.join(dir, "note.md"), lines(["a(); b();"]));
  assert.deepStrictEqual(blocks.run([dir]), [path.join(dir, "bad.js") + ":1 statements on one line"]);
  assert.throws(function () {
    blocks.run([path.join(dir, "none")]);
  });
});
