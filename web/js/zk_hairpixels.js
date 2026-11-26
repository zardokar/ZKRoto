// PHYSICAL (browser): picture and mark of a request as pixels (full size, not the copies sent to Claude), the hair part
// from zk_hairsplit.js, drawn as hair.png (white = hair) for the recipe. Any failure or no split -> null (whole mark).
import { hairSplit } from "./zk_hairsplit.js";

function pixels(url, w, h, ms) {
  return new Promise(function (ok) {
    const timer = setTimeout(() => ok(null), ms);
    const img = new Image();
    img.onload = function () {
      try {
        const c = document.createElement("canvas");
        c.width = w || img.naturalWidth;
        c.height = h || img.naturalHeight;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0, c.width, c.height);
        ok({ w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data });
      } catch (e) {
        ok(null);
      }
      clearTimeout(timer);
    };
    img.onerror = function () {
      clearTimeout(timer);
      ok(null);
    };
    img.src = url;
  });
}

export function toPng(matte, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  const img = g.createImageData(w, h);
  for (let i = 0; i < matte.length; i++) {
    const v = matte[i] ? 255 : 0;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return new Promise((ok) => c.toBlob(ok, "image/png"));
}

export async function hairOf(srcUrl, maskUrl, cfg) {
  const src = await pixels(srcUrl, 0, 0, cfg.hairLoadMs);
  const mask = src ? await pixels(maskUrl, src.w, src.h, cfg.hairLoadMs) : null;
  const split = src && mask ? hairSplit(src.data, mask.data, cfg) : null;
  if (!split) {
    return null;
  }
  const blob = await toPng(split.matte, src.w, src.h);
  return blob ? { blob, share: split.share } : null;
}
