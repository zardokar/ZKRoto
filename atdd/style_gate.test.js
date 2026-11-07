// Gate: both house checkers (dev/check_style.js, dev/check_blocks.js) find nothing in the ZKRoto tree.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TARGETS = ["web", "atdd", "dev", "batch", "docs", "third-party/NOTICE.md", "README.md"].map(function (p) {
  return path.join(ROOT, p);
});
const style = require(path.join(ROOT, "dev", "check_style.js"));
const blocks = require(path.join(ROOT, "dev", "check_blocks.js"));

test("check_style: 0 findings", function () {
  assert.deepStrictEqual(style.run(TARGETS), []);
});

test("check_blocks: 0 findings", function () {
  const js = TARGETS.filter(function (t) {
    return !t.endsWith(".md");
  });
  assert.deepStrictEqual(blocks.run(js), []);
});

test("no .mjs left in web/ (the checkers only read .js)", function () {
  const fs = require("fs");
  const found = [];
  const walk = function (dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p);
      } else if (p.endsWith(".mjs")) {
        found.push(p);
      }
    }
  };
  walk(path.join(ROOT, "web"));
  assert.deepStrictEqual(found, []);
});
