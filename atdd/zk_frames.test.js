// Unit tests for web/js/zk_frames.js (frame grid, seek time, shown frame, names, URLs).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { pathToFileURL } = require("url");

const MODULE = pathToFileURL(path.join(__dirname, "..", "web", "js", "zk_frames.js")).href;
const NTSC = 30000 / 1001;

function load() {
  return import(MODULE);
}

test("parseFps reads num/den and a plain number", async function () {
  const f = await load();
  assert.deepStrictEqual(f.parseFps("30000/1001"), { num: 30000, den: 1001 });
  assert.deepStrictEqual(f.parseFps("25"), { num: 25, den: 1 });
});

test("totalFrames: the 29.97 test clip of 10.01 s has 300 frames, never fewer than 1", async function () {
  const f = await load();
  assert.strictEqual(f.totalFrames(10.01, NTSC), 300);
  assert.strictEqual(f.totalFrames(0, NTSC), 1);
});

test("clampFrame rounds and clamps to 0 .. total - 1", async function () {
  const f = await load();
  assert.strictEqual(f.clampFrame(400, 300), 299);
  assert.strictEqual(f.clampFrame(-5, 300), 0);
  assert.strictEqual(f.clampFrame(12.6, 300), 13);
  assert.strictEqual(f.clampFrame("7", 300), 7);
});

test("seekTime is the middle of frame n", async function () {
  const f = await load();
  assert.strictEqual(f.seekTime(0, NTSC), 0.5 / NTSC);
  assert.strictEqual(f.seekTime(123, NTSC), 123.5 / NTSC);
});

test("shownFrame gives n for both mediaTime styles (frame start and seek target) on all 300 frames", async function () {
  const f = await load();
  for (let n = 0; n < 300; n += 1) {
    assert.strictEqual(f.shownFrame(n / NTSC, NTSC, 300), n, `frame start ${n}`);
    assert.strictEqual(f.shownFrame((n + 0.5) / NTSC, NTSC, 300), n, `seek target ${n}`);
  }
  assert.strictEqual(f.shownFrame(4.120783, NTSC, 300), 123, "value measured in the browser pane");
});

test("shownFrame clamps to the last frame when the video time snaps to the clip end", async function () {
  const f = await load();
  assert.strictEqual(f.shownFrame(10.01, NTSC, 300), 299, "measured: second seek to frame 299 gives mediaTime 10.01");
  assert.strictEqual(f.shownFrame(12, NTSC, 300), 299);
  assert.strictEqual(f.shownFrame(9.993316, NTSC, 300), 299);
});

test("pad, safeBase and captureName build the capture file name", async function () {
  const f = await load();
  assert.strictEqual(f.pad(123, 6), "000123");
  assert.strictEqual(f.safeBase("my clip (1).mp4"), "my_clip_1_");
  assert.strictEqual(f.safeBase("zkroto_test_2997.mp4"), "zkroto_test_2997");
  assert.strictEqual(f.captureName("zkroto_test_2997", 123, 6), "zkroto_test_2997_f000123.png");
});

test("inputUrl splits a sub-folder and accepts backslashes", async function () {
  const f = await load();
  assert.strictEqual(f.inputUrl("clip.mp4"), "/api/view?type=input&filename=clip.mp4&subfolder=");
  assert.strictEqual(f.inputUrl("sub/clip a.mp4"), "/api/view?type=input&filename=clip%20a.mp4&subfolder=sub");
  assert.strictEqual(f.inputUrl("a\\b\\c.mp4"), "/api/view?type=input&filename=c.mp4&subfolder=a%2Fb");
});

test("isUrl tells URLs from names in input", async function () {
  const f = await load();
  assert.strictEqual(f.isUrl("http://h/a.mp4"), true);
  assert.strictEqual(f.isUrl("https://h/a.mp4"), true);
  assert.strictEqual(f.isUrl("blob:abc"), true);
  assert.strictEqual(f.isUrl("/api/view?x=1"), true);
  assert.strictEqual(f.isUrl("clip.mp4"), false);
});

test("nameFromUrl and nameFromInput keep only the file name", async function () {
  const f = await load();
  assert.strictEqual(f.nameFromUrl("http://h/v/a%20b.mp4?x=1"), "a b.mp4");
  assert.strictEqual(f.nameFromInput("sub\\clip.mp4"), "clip.mp4");
  assert.strictEqual(f.nameFromInput("clip.mp4"), "clip.mp4");
});
