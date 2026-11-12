// Export of a frame range (0.2.9): web/js/zk_range.js with a fake video (seek), fake pose and the in-memory server.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const { CFG, K, PERSON, load, fakeCanvas, fakeServer } = require("./exporter_kit.js");

const POV = "pov_y000_h155_d120_f60";

// Frame n: the fixture person, world scaled by 1 + n / 10 (so a per-frame fit would hide the change of size).
function personAt(n) {
  const k = 1 + n / 10;
  return { ...PERSON, world: PERSON.world.map(function (p) {
    return [p[0] * k, p[1] * k, p[2] * k];
  }) };
}

async function setup(opts) {
  const o = opts || {};
  const { createBus } = await load("zk_events.js");
  const { createPovApi } = await load("zk_povapi.js");
  const { createRender } = await load("zk_render.js");
  const { createExporter } = await load("zk_exporter.js");
  const { createRange } = await load("zk_range.js");
  const { fmt } = await load("zk_text.js");
  const state = { name: "clip.mp4", url: "blob:x", frame: 0, total: o.total || 4, fpsNum: 30, fpsDen: 1, lastPose: null,
    still: !!o.still };
  const t = function (key, v) {
    return fmt(K.text[key], v || {});
  };
  const ctx = { cfg: CFG, k: K, state, bus: createBus(), t, log: function () {
    return null;
  }, status: function () {
    return null;
  }, fps: function () {
    return 30;
  } };
  const povApi = createPovApi(ctx);
  const server = fakeServer();
  const seeks = [];
  let poses = 0;
  const seek = async function (n) {
    seeks.push(n);
    state.frame = n;
    state.lastPose = null;
  };
  const pose = async function () {
    poses += 1;
    if (o.onPose) {
      o.onPose(state.frame, range);
    }
    const missing = (o.missing || []).includes(state.frame);
    state.lastPose = { frame: state.frame, width: 1024, height: 1536, people: missing ? [] : [personAt(state.frame)] };
    return state.lastPose;
  };
  const fetch = function (url, init) {
    return server.fetch(url, init);
  };
  const exporter = createExporter(ctx, { povApi, render: createRender(K, CFG, fakeCanvas), fetch, pose });
  const range = createRange(ctx, { seek, pose, povApi, exporter });
  povApi.options({ view: "pov", names: { shot: "walk01" } });
  return { range, exporter, povApi, server, state, seeks, poses: function () {
    return poses;
  } };
}

function opJson(server, n) {
  return server.files[`openpose/pov/walk01_f${String(n).padStart(6, "0")}_${POV}.json`].json.people[0].pose_keypoints_2d;
}

function neckHipY(kp) {
  return kp[8 * 3 + 1] - kp[1 * 3 + 1];
}

test("range: every frame exported (src + POV), pose once per frame, frames visited in order twice", async function () {
  const { range, server, seeks, poses } = await setup();
  const out = await range.exportRange({ from: 0, to: 3 });
  assert.deepStrictEqual([out.from, out.to, out.exported, out.missing, out.stopped], [0, 3, 4, [], false]);
  assert.strictEqual(poses(), 4, "pose is not run again in the export pass");
  assert.deepStrictEqual(seeks, [0, 1, 2, 3, 0, 1, 2, 3]);
  for (let n = 0; n < 4; n += 1) {
    const f = String(n).padStart(6, "0");
    for (const name of [`openpose/src/walk01_f${f}_src.png`, `openpose/pov/walk01_f${f}_${POV}.png`,
      `openpose/full/pov/walk01_f${f}_${POV}.png`, `mediapipe/pov/walk01_f${f}_${POV}.json`, `zkroto/walk01_f${f}.json`]) {
      assert.ok(server.files[name], name);
    }
  }
  assert.deepStrictEqual(server.files["zkroto/walk01_shot.json"].json.frames.map(function (r) {
    return r.frame;
  }), [0, 1, 2, 3]);
});

test("range: ONE framing for every frame (size change kept), recorded in each frame JSON; sheets built once", async function () {
  const { range, server } = await setup();
  await range.exportRange({ from: 0, to: 3 });
  const ratio = neckHipY(opJson(server, 3)) / neckHipY(opJson(server, 0));
  assert.ok(ratio > 1.2, `body grows 30 % over the range, kept in the pictures (ratio ${ratio})`);
  const fits = [0, 1, 2, 3].map(function (n) {
    return server.files[`zkroto/walk01_f${String(n).padStart(6, "0")}.json`].json.cameras[POV];
  });
  assert.ok(fits[0].fit && fits[0].fit.s > 0, "fit transform recorded");
  fits.forEach(function (c) {
    assert.deepStrictEqual([c.fit, c.range], [fits[0].fit, [0, 3]]);
  });
  const sheetPosts = server.posts.filter(function (p) {
    return p.files.some(function (f) {
      return f.sub === "mediapipe";
    });
  });
  assert.strictEqual(sheetPosts.length, 2, "one sheet per camera at the end, not one per frame");
  for (let n = 0; n < 4; n += 1) {
    const kp = opJson(server, n);
    for (let j = 0; j < 18; j += 1) {
      if (kp[j * 3 + 2] > 0) {
        assert.ok(kp[j * 3] >= -1e-6 && kp[j * 3] <= 832 + 1e-6 && kp[j * 3 + 1] >= -1e-6 && kp[j * 3 + 1] <= 1216 + 1e-6,
          `frame ${n} joint ${j} inside the picture`);
      }
    }
  }
});

test("range: frames without the chosen person are skipped and listed; the rest still share one framing", async function () {
  const { range, server } = await setup({ missing: [2] });
  const out = await range.exportRange({ from: 0, to: 3 });
  assert.deepStrictEqual([out.exported, out.missing], [3, [2]]);
  assert.strictEqual(server.files[`zkroto/walk01_f000002.json`], undefined);
});

test("range: Stop during the pose pass writes nothing; Stop during export keeps what was written", async function () {
  const a = await setup({ onPose: function (frame, range) {
    if (frame === 1) {
      range.stop();
    }
  } });
  const outA = await a.range.exportRange({ from: 0, to: 3 });
  assert.deepStrictEqual([outA.stopped, outA.exported, a.server.posts.length], [true, 0, 0]);
  const b = await setup();
  let n = 0;
  const realFetch = b.server.fetch;
  b.server.fetch = async function (url, init) {
    if (init.method === "POST" && !init.body.includes("\"mediapipe\"")) {
      n += 1;
      if (n === 2) {
        b.range.stop();
      }
    }
    return realFetch(url, init);
  };
  const outB = await b.range.exportRange({ from: 0, to: 3 });
  assert.deepStrictEqual([outB.stopped, outB.exported], [true, 2]);
});

test("range: empty from / to = the whole clip; a still = frame 0; bad ranges refused; Ctrl+E waits while it runs", async function () {
  const { range, seeks, exporter } = await setup({ total: 3 });
  const out = await range.exportRange({});
  assert.deepStrictEqual([out.from, out.to, out.exported], [0, 2, 3]);
  assert.strictEqual(seeks.length, 6);
  await assert.rejects(range.exportRange({ from: 2, to: 1 }), /range/);
  await assert.rejects(range.exportRange({ from: -1, to: 1 }), /range/);
  await assert.rejects(range.exportRange({ from: 0, to: 3 }), /range/);
  const still = await setup({ still: true, total: 1 });
  assert.deepStrictEqual((await still.range.exportRange({ from: 0, to: 5 })).to, 0);
  const busy = await setup({ onPose: function () {
    return null;
  } });
  const p = busy.range.exportRange({ from: 0, to: 3 });
  await assert.rejects(busy.exporter.exportPose(), /still running/);
  await p;
  assert.ok(exporter);
});

test("range in the source view only (no POV): no framing recorded, src files for every frame", async function () {
  const { range, povApi, server } = await setup();
  povApi.options({ view: "source" });
  const out = await range.exportRange({ from: 1, to: 2, src: true });
  assert.strictEqual(out.exported, 2);
  assert.ok(server.files["openpose/src/walk01_f000001_src.png"] && server.files["openpose/src/walk01_f000002_src.png"]);
  assert.strictEqual(server.files["zkroto/walk01_f000001.json"].json.cameras.src.fit, undefined);
});
