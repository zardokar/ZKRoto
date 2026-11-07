// batch/commit.bat: the commit message in its SETTINGS block is <=120 characters and safe for cmd.exe.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const BAT = path.join(__dirname, "..", "batch", "commit.bat");
const MSG_LINE = /^set "MSG=(.*)"\r$/m;
const MAX_CHARS = 120;
const CMD_SPECIAL = /[%!&|<>^"]/;

test("commit message is set, <=120 characters, without characters cmd.exe would treat specially", function () {
  const m = fs.readFileSync(BAT, "utf8").match(MSG_LINE);
  assert.ok(m, "no set \"MSG=...\" line");
  assert.ok(m[1].length > 0 && m[1].length <= MAX_CHARS, `length ${m[1].length}`);
  assert.strictEqual(CMD_SPECIAL.test(m[1]), false, m[1]);
});

test("commit.bat asks before committing and before pushing", function () {
  const src = fs.readFileSync(BAT, "utf8");
  assert.match(src, /choice \/c YN \/m "Commit/);
  assert.match(src, /choice \/c YN \/m "Push/);
});
