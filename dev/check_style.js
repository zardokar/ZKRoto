// House-rule checker (coder §4b). Prints "file:line what-is-wrong", exit 1 on any finding, 0 when clean.
// Rules: C1 ≤200 lines · no one-line functions · comments ≤3 lines · endings per file class ·
// deps = electron only · no sibling-module imports. USAGE: node core_dev/check_style.js <dir> [<dir>...]
"use strict";

const fs = require("fs");
const path = require("path");

const LIMITS = { maxLines: 200, maxCommentLines: 3, allowedDeps: ["electron"] };
const SKIP_DIRS = new Set(["node_modules", ".git", ".temp", "pack", "_to_delete", ".dropzone", "arch"]);
const LF_EXT = new Set([".js", ".json", ".md"]);
const CRLF_EXT = new Set([".bat", ".html", ".css"]);
const ONE_LINE_FN = /\bfunction\b[^{]*\)\s*\{[^}\n]*\S[^}\n]*\}/;
const ONE_LINE_ARROW = /=>\s*\{[^}\n]*\S[^}\n]*\}/;

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) {
        walk(full, out);
      }
    } else {
      out.push(full);
    }
  }
  return out;
}

function checkEndings(file, text, ext, findings) {
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/\n/g) || []).length - crlf;
  if (LF_EXT.has(ext) && crlf > 0) {
    findings.push(`${file}:1 expected LF, found ${crlf} CRLF line(s)`);
  }
  if (CRLF_EXT.has(ext) && lf > 0) {
    findings.push(`${file}:1 expected CRLF, found ${lf} bare LF line(s)`);
  }
}

function checkLength(file, lines, findings) {
  if (lines.length > LIMITS.maxLines) {
    findings.push(`${file}:${LIMITS.maxLines + 1} file has ${lines.length} lines (C1 max ${LIMITS.maxLines})`);
  }
}

function checkOneLiners(file, lines, findings) {
  lines.forEach(function (line, i) {
    if (ONE_LINE_FN.test(line) || ONE_LINE_ARROW.test(line)) {
      findings.push(`${file}:${i + 1} one-line function body`);
    }
  });
}

function checkComments(file, lines, findings) {
  let run = 0;
  let start = 0;
  let inBlock = false;
  lines.forEach(function (line, i) {
    const t = line.trim();
    if (inBlock) {
      run += 1;
      if (t.includes("*/")) {
        inBlock = false;
        if (run > LIMITS.maxCommentLines) {
          findings.push(`${file}:${start + 1} comment block of ${run} lines (max ${LIMITS.maxCommentLines}) -> docs/`);
        }
        run = 0;
      }
      return;
    }
    if (t.startsWith("/*") && !t.includes("*/")) {
      inBlock = true;
      start = i;
      run = 1;
      return;
    }
    if (t.startsWith("//")) {
      if (run === 0) {
        start = i;
      }
      run += 1;
      return;
    }
    if (run > LIMITS.maxCommentLines) {
      findings.push(`${file}:${start + 1} comment block of ${run} lines (max ${LIMITS.maxCommentLines}) -> docs/`);
    }
    run = 0;
  });
}

function checkSiblingImports(file, lines, findings) {
  const m = file.replace(/\\/g, "/").match(/\/module\/([^/]+)\//);
  if (!m) {
    return;
  }
  const self = m[1];
  lines.forEach(function (line, i) {
    const req = line.match(/require\(\s*["']([^"']+)["']\s*\)/);
    if (!req) {
      return;
    }
    const target = req[1];
    if (!target.startsWith(".")) {
      return;
    }
    const resolved = path.resolve(path.dirname(file), target).replace(/\\/g, "/");
    const other = resolved.match(/\/module\/([^/]+)\//);
    if (other && other[1] !== self) {
      findings.push(`${file}:${i + 1} imports sibling module "${other[1]}" (facade rule)`);
    }
  });
}

function checkDeps(root, findings) {
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return;
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const all = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  for (const dep of Object.keys(all)) {
    if (!LIMITS.allowedDeps.includes(dep)) {
      findings.push(`${pkgPath}:1 dependency "${dep}" is not allowed (Q1: electron only)`);
    }
  }
}

function checkFile(file, findings) {
  const ext = path.extname(file).toLowerCase();
  if (!LF_EXT.has(ext) && !CRLF_EXT.has(ext)) {
    return;
  }
  const text = fs.readFileSync(file, "utf8");
  checkEndings(file, text, ext, findings);
  const lines = text.split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  if (ext === ".js" || ext === ".css" || ext === ".html" || ext === ".bat") {
    checkLength(file, lines, findings);
  }
  if (ext === ".js") {
    checkOneLiners(file, lines, findings);
    checkComments(file, lines, findings);
    checkSiblingImports(file, lines, findings);
  }
}

function run(targets) {
  const findings = [];
  for (const t of targets) {
    const root = path.resolve(t);
    const files = fs.statSync(root).isDirectory() ? walk(root, []) : [root];
    for (const f of files) {
      checkFile(f, findings);
    }
    if (fs.statSync(root).isDirectory()) {
      checkDeps(root, findings);
    }
  }
  return findings;
}

if (require.main === module) {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    targets.push(".");
  }
  const findings = run(targets);
  for (const f of findings) {
    console.log(f);
  }
  console.log(findings.length === 0 ? "check_style: PASS (0 findings)" : `check_style: FAIL (${findings.length} findings)`);
  process.exit(findings.length === 0 ? 0 : 1);
}

module.exports = { run, checkFile, LIMITS };
