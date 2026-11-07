// Block check beside check_style.js (coder §3b; from ZPLS lib/tools/check_blocks.js, 2026-11-02): a block with statements on one line, or two statements on one line, in
// code outside strings, templates, regex literals and comments (sees what the per-line regex of check_style.js misses).
// USAGE: node check_blocks.js <dir|file> […]; prints "file:line why", exit 1 on any finding.
"use strict";

const fs = require("fs");
const path = require("path");

const SKIP_DIRS = new Set(["node_modules", ".git", "out"]);
const REGEX_AFTER = "(,=:[!&|?{};+-*%<>~^";
const REGEX_WORDS = ["return", "typeof", "case", "in", "of", "delete", "void", "throw", "new"];
const WHY_BLOCK = "block on one line";
const WHY_TWO = "statements on one line";

function frame(kind, line) {
  return { kind, line, semis: 0, last: -1 };
}

// true when a "/" at i starts a regex literal: what comes before it cannot end an expression
function regexAt(text, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(text[j])) {
    j -= 1;
  }
  if (j < 0 || REGEX_AFTER.indexOf(text[j]) >= 0) {
    return true;
  }
  const word = text.slice(0, j + 1).match(/[A-Za-z_$]+$/);
  return word !== null && REGEX_WORDS.indexOf(word[0]) >= 0;
}

// index just after a quoted string, a comment or a regex literal that starts at i
function skip(text, i) {
  const c = text[i];
  if (c === "/" && text[i + 1] === "/") {
    const end = text.indexOf("\n", i);
    return end < 0 ? text.length : end;
  }
  if (c === "/" && text[i + 1] === "*") {
    const end = text.indexOf("*/", i + 2);
    return end < 0 ? text.length : end + 2;
  }
  let j = i + 1;
  let inClass = false;
  while (j < text.length) {
    const d = text[j];
    if (d === "\\") {
      j += 2;
      continue;
    }
    if (c === "/" && d === "[") {
      inClass = true;
    } else if (c === "/" && d === "]") {
      inClass = false;
    } else if (d === c && !inClass) {
      break;
    }
    j += 1;
  }
  return j + 1;
}

function scan(text) {
  const found = [];
  const stack = [frame("root", 0)];
  let line = 1;
  let i = 0;
  const top = function () {
    return stack[stack.length - 1];
  };
  const add = function (why) {
    found.push({ line, why });
  };
  while (i < text.length) {
    const c = text[i];
    if (top().kind === "tpl") {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === "`") {
        stack.pop();
      } else if (c === "$" && text[i + 1] === "{") {
        stack.push(frame("expr", line));
        i += 1;
      } else if (c === "\n") {
        line += 1;
      }
      i += 1;
      continue;
    }
    const starts = c === "\"" || c === "'" || (c === "/" && (text[i + 1] === "/" || text[i + 1] === "*" || regexAt(text, i)));
    if (starts) {
      const end = skip(text, i);
      line += (text.slice(i, end).match(/\n/g) || []).length;
      i = end;
      continue;
    }
    if (c === "\n") {
      line += 1;
    } else if (c === "`") {
      stack.push(frame("tpl", line));
    } else if (c === "(" || c === "{") {
      stack.push(frame(c === "(" ? "paren" : "brace", line));
    } else if ((c === ")" || c === "}") && stack.length > 1) {
      const f = stack.pop();
      if (f.kind === "brace" && f.line === line && f.semis > 0) {
        add(WHY_BLOCK);
      }
    } else if (c === ";" && top().kind !== "paren") {
      const f = top();
      f.semis += 1;
      if (f.last === line && found.every(function (x) {
        return x.line !== line || x.why !== WHY_TWO;
      })) {
        add(WHY_TWO);
      }
      f.last = line;
    }
    i += 1;
  }
  return found;
}

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) {
        walk(p, out);
      }
    } else if (p.endsWith(".js")) {
      out.push(p);
    }
  });
  return out;
}

function run(targets) {
  const out = [];
  targets.forEach(function (t) {
    const files = fs.statSync(t).isDirectory() ? walk(t, []) : [t];
    files.forEach(function (f) {
      scan(fs.readFileSync(f, "utf8")).forEach(function (x) {
        out.push(`${f}:${x.line} ${x.why}`);
      });
    });
  });
  return out;
}

if (require.main === module) {
  const findings = run(process.argv.length > 2 ? process.argv.slice(2) : ["."]);
  findings.forEach(function (f) {
    console.log(f);
  });
  console.log(findings.length === 0 ? "check_blocks: PASS (0 findings)" : `check_blocks: FAIL (${findings.length} findings)`);
  process.exit(findings.length === 0 ? 0 : 1);
}

module.exports = { scan, run };
