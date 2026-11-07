// COMPONENT: selftest for zkroto_test_2997.mp4 - seek, read the 16 bit squares, compare with the request.
import { bitCenters, meanBrightness, decodeBits } from "./zk_bits.js";

export function createSelftest(ctx, video) {
  const spec = ctx.cfg.testPattern;
  const centers = bitCenters(spec);
  const half = spec.probe / 2;

  function readBits(c) {
    const g = c.getContext("2d", { willReadFrequently: true });
    const means = centers.map(function ([x, y]) {
      return meanBrightness(g.getImageData(x - half, y - half, spec.probe, spec.probe).data);
    });
    return decodeBits(means, spec.threshold);
  }

  function defaultFrames() {
    const total = ctx.state.total;
    const frames = spec.fixedFrames.concat([total - 2, total - 1]);
    for (let i = 0; i < spec.randomFrames; i += 1) {
      frames.push(Math.floor(Math.random() * total));
    }
    return frames;
  }

  async function selftest(frames) {
    const list = frames || defaultFrames();
    const rows = [];
    for (const n of list) {
      const r = await video.seek(n);
      const bits = readBits(video.frameCanvas());
      rows.push({ requested: r.requested, shown: r.shown, pixels: bits, ok: bits === r.requested && r.shown === r.requested });
    }
    const bad = rows.filter(function (r) {
      return !r.ok;
    });
    ctx.log(ctx.t("selftest", { ok: rows.length - bad.length, total: rows.length }));
    return { total: rows.length, ok: rows.length - bad.length, bad, rows };
  }

  return {
    selftest,
    readBits: function () {
      return readBits(video.frameCanvas());
    },
  };
}
