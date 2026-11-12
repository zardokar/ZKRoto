// Trial runner (user, voice 2026-11-09 22:0x): ZKRoto's POV of the FRA-007 front.png pose vs MediaPipe on the
// reference pictures front.png / side.png, joint by joint on a 20 x 30 grid; --record appends to atdd/trials.json.
// node dev/zk_trial.js --id T07 --title "..." --params '{"depth":0.25,"xy":"image"}' [--why "..."] [--record]
"use strict";

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { compareGrid } = require("./zk_grid");

const ROOT = path.join(__dirname, "..");
const TRIALS = path.join(ROOT, "atdd", "trials.json");
const GRID = { cols: 20, rows: 30 };
const DISTANCE = 3;
const VIEWS = [["front", "front_pose_face.json", 0], ["side", "side_pose.json", 90]];
const SOURCE = { body: "MediaPipe Pose 33 (image + world) -> OpenPose 18", face: "MediaPipe Face Landmarker 478 -> OpenPose face 70" };

function json(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function load(name) {
  return import(pathToFileURL(path.join(ROOT, "web", "js", name)).href);
}

function args(argv) {
  const out = { params: "{}" };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, "");
    if (key === "record") {
      out.record = true;
    } else {
      out[key] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

// POV points (fitted into the picture size) back onto the reference picture, through the reference's own fit.
function backOnto(points, tr) {
  return points.map(function (p) {
    return p[2] > 0 ? [(p[0] - tr.tx) / tr.s, (p[1] - tr.ty) / tr.s, p[2]] : [0, 0, 0];
  });
}

async function measure(params) {
  const S = await load("zk_povstate.js");
  const V = await load("zk_pov.js");
  const F = await load("zk_framing.js");
  const cfg = json("web/config/zkroto.json");
  const k = json("web/constants/zkroto.json");
  const front = json("atdd/fixtures/front_pose_face.json");
  const sheet = json("atdd/fixtures/side_pose.json");
  const src = { width: front.width, height: front.height, side: sheet };
  const faceNames = front.person.face.image.slice(0, 70).map(function (_p, i) {
    return `face ${i}`;
  });
  const results = {};
  for (const [view, file, yaw] of VIEWS) {
    const ref = json(`atdd/fixtures/${file}`);
    const size = [ref.width, ref.height];
    const real = V.srcPoints(ref.person, ref.width, ref.height, cfg.pov.threshold);
    const tr = F.fitTransform(real.op, size, cfg.pov.margins);
    let pov = S.setOptions(S.setCamera(S.povDefaults(cfg), { yaw, distance: params.distance || DISTANCE, fov: params.fov }, cfg), params, cfg);
    pov = { ...pov, xy: params.xy || pov.xy, blend: params.blend, fit: params.fit };
    const probe = V.povPoints(front.person, pov, size, cfg, src);
    pov = S.setCamera(pov, { eyeHeight: probe.target[1] - probe.floor }, cfg);
    const r = V.povPoints(front.person, pov, size, cfg, src);
    results[view] = {
      op: compareGrid(real.op, backOnto(r.op, tr), k.opNames, size, GRID),
      mp: compareGrid(real.mp, backOnto(r.mp, tr), k.mpNames, size, GRID),
    };
    if (real.face && r.face) {
      results[view].face = compareGrid(real.face.op, backOnto(r.face.op, tr), faceNames, size, GRID);
    }
  }
  return results;
}

function verdict(results) {
  const all = Object.values(results).flatMap(function (v) {
    return Object.values(v);
  });
  return all.every(function (x) {
    return x.summary.same === x.summary.n;
  }) ? "PASS" : "FAIL";
}

function print(results) {
  for (const [view, layers] of Object.entries(results)) {
    for (const [layer, res] of Object.entries(layers)) {
      const s = res.summary;
      console.log(`${view} ${layer}: ${s.same}/${s.n} same cell, ${s.near} one off, ${s.far} further; worst ${s.worst}`);
      const off = res.joints.filter(function (j) {
        return j.verdict !== "same" && layer === "op";
      });
      for (const j of off) {
        console.log(`    ${j.name}: ${j.off}`);
      }
    }
  }
}

function stamp() {
  const f = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" });
  return f.format(new Date());
}

function compact(results) {
  const out = {};
  for (const [view, layers] of Object.entries(results)) {
    out[view] = {};
    for (const [layer, res] of Object.entries(layers)) {
      out[view][layer] = { summary: res.summary, joints: res.joints.map(function (j) {
        return [j.name, j.verdict, j.off];
      }) };
    }
  }
  return out;
}

async function main() {
  const a = args(process.argv);
  const params = JSON.parse(a.params);
  const results = await measure(params);
  print(results);
  const v = verdict(results);
  console.log(`verdict: ${v}`);
  if (!a.record) {
    return;
  }
  const k = json("web/constants/zkroto.json");
  const list = fs.existsSync(TRIALS) ? JSON.parse(fs.readFileSync(TRIALS, "utf8")) : { about: "", trials: [] };
  list.trials.push({
    id: a.id, date: stamp(), version: k.version, title: a.title, params, source: SOURCE,
    camera: { distance: params.distance || DISTANCE, eye: "chest height", yaw: { front: 0, side: 90 } }, grid: GRID,
    measuredBy: "dev/zk_trial.js", verdict: v, why: a.why || "", results: compact(results),
  });
  fs.writeFileSync(TRIALS, `${JSON.stringify(list, null, 1)}\n`);
  console.log(`recorded ${a.id} in atdd/trials.json`);
}

main();
