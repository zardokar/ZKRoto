// Runs the Python tests of zk_export.py (the rules of the /zkroto/export route) from node --test.
// Python: env ZK_PYTHON (atdd\all_test.bat sets ComfyUI's venv python), else "python".
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PYTHON = process.env.ZK_PYTHON || "python";
const ARGS = ["-m", "unittest", "discover", "-s", "atdd", "-p", "test_*.py"];

test("zk_export.py: python unittest passes (route refuses .., slashes, wrong names and folders)", function () {
  const r = spawnSync(PYTHON, ARGS, { cwd: ROOT, encoding: "utf8" });
  assert.ok(!r.error, `cannot run ${PYTHON}: ${r.error && r.error.message} (set ZK_PYTHON)`);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stderr, /OK/);
});
