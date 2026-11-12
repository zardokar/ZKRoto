// Test helper for the Export tests: the POV facade + exporter with a fake canvas and an in-memory stand-in server.
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const JS = path.join(__dirname, "..", "web", "js");
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "config", "zkroto.json"), "utf8"));
const K = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "web", "constants", "zkroto.json"), "utf8"));
const PERSON = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "pose_fra007_f10_v011.json"), "utf8"))[0];

function load(name) {
  return import(pathToFileURL(path.join(JS, name)).href);
}

function fakeCanvas(w, h) {
  const g = new Proxy({}, {
    get: function (target, key) {
      return key in target ? target[key] : function () {
        return null;
      };
    },
  });
  return { width: w, height: h, getContext: function () {
    return g;
  }, toDataURL: function () {
    return "data:image/png;base64,iVBORw0KGgo=";
  } };
}

// In-memory stand-in for /zkroto/export, /zkroto/shot and /zkroto/sheetdata.
function fakeServer() {
  const files = {};
  const posts = [];
  const gets = [];
  const reply = function (data, status) {
    return { ok: !status, status: status || 200, json: async function () {
      return data;
    } };
  };
  const fetch = async function (url, opts) {
    const u = new URL(url, "http://x");
    if (opts.method === "POST") {
      const body = JSON.parse(opts.body);
      posts.push(body);
      const written = body.files.map(function (f) {
        files[`${f.sub}/${f.name}`] = f;
        return `ZKRoto/${body.folder}/${f.sub}/${f.name}`;
      });
      return reply({ folder: body.folder, written });
    }
    gets.push(url);
    if (u.pathname === CFG.export.shotRoute) {
      const shot = files[`zkroto/${u.searchParams.get("folder")}_shot.json`];
      const frame = files[`zkroto/${u.searchParams.get("frame")}`];
      return reply({ shot: shot ? shot.json : null, frame: frame ? frame.json : null });
    }
    const cam = u.searchParams.get("camera");
    const frames = Object.values(files).filter(function (f) {
      return f.json && f.sub.startsWith("mediapipe/") && f.name.endsWith(`_${cam}.json`);
    }).map(function (f) {
      return f.json;
    });
    return reply({ frames });
  };
  return { files, posts, fetch, gets: function () {
    return gets.slice();
  } };
}

async function setup(people) {
  const { createBus } = await load("zk_events.js");
  const { createPovApi } = await load("zk_povapi.js");
  const { createRender } = await load("zk_render.js");
  const { createExporter } = await load("zk_exporter.js");
  const { fmt } = await load("zk_text.js");
  const state = { name: "clip.mp4", url: "blob:x", frame: 123, fpsNum: 30000, fpsDen: 1001, lastPose: null };
  const ctx = { cfg: CFG, k: K, state, bus: createBus(), t: function (key, v) {
    return fmt(K.text[key], v || {});
  }, log: function () {
    return null;
  }, status: function () {
    return null;
  }, fps: function () {
    return 30000 / 1001;
  } };
  const povApi = createPovApi(ctx);
  const server = fakeServer();
  let poseCalls = 0;
  const pose = async function () {
    poseCalls += 1;
    state.lastPose = { frame: state.frame, width: 1024, height: 1536, people: people || [PERSON] };
    return state.lastPose;
  };
  const fetch = function (url, opts) {
    return server.fetch(url, opts);
  };
  const ex = createExporter(ctx, { povApi, render: createRender(K, CFG, fakeCanvas), fetch, pose });
  return { ex, povApi, server, state, calls: function () {
    return poseCalls;
  } };
}

module.exports = { setup, CFG, K, PERSON, load, fakeCanvas, fakeServer };
