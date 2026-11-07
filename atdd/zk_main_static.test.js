// zk_main.js must read config and constants as static JSON module imports, so window.zk is set while the
// module graph evaluates (as in 0.1.1), not after extra fetches (review 2026-11-07, findings 1 and 2).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const MAIN = path.join(__dirname, "..", "web", "js", "zk_main.js");
const JSON_IMPORT = /^import \w+ from "\.\.\/(config|constants)\/zkroto\.json" with \{ type: "json" \};$/gm;

test("config and constants are static JSON imports", function () {
  const src = fs.readFileSync(MAIN, "utf8");
  const found = [...src.matchAll(JSON_IMPORT)].map(function (m) {
    return m[1];
  });
  assert.deepStrictEqual(found.sort(), ["config", "constants"]);
});

test("zk_main.js does not fetch anything and does not start asynchronously", function () {
  const src = fs.readFileSync(MAIN, "utf8");
  assert.strictEqual(/\bfetch\(/.test(src), false);
  assert.strictEqual(/async function start/.test(src), false);
});
