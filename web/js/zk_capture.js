// COMPONENT: save the shown frame as PNG into ComfyUI input\<app>\capture\<video>\ through /api/upload/image.
import { captureName } from "./zk_frames.js";
import { captureSubfolder } from "./zk_naming.js";

const UPLOAD_URL = "/api/upload/image";
const PNG = "image/png";

export async function upload(ctx, blob, filename, subfolder) {
  const fd = new FormData();
  fd.append("image", blob, filename);
  fd.append("type", "input");
  fd.append("subfolder", subfolder);
  fd.append("overwrite", "true");
  const r = await fetch(UPLOAD_URL, { method: "POST", body: fd });
  if (!r.ok) {
    throw new Error(ctx.t("uploadFailed", { status: r.status }));
  }
  return r.json();
}

export function createCapture(ctx, video) {
  const { cfg, k, state, t } = ctx;

  async function capture() {
    if (!state.url) {
      throw new Error(t("noVideo"));
    }
    const c = video.frameCanvas();
    const blob = await new Promise(function (res) {
      c.toBlob(res, PNG);
    });
    const filename = captureName(state.base, state.frame, cfg.frameDigits);
    const resp = await upload(ctx, blob, filename, captureSubfolder(k.app, cfg.export.captureFolder, state.base));
    state.lastCapture = {
      frame: state.frame, shown: state.shown, mediaTime: state.mediaTime,
      name: resp.name, subfolder: resp.subfolder, type: resp.type,
      path: `input/${resp.subfolder}/${resp.name}`, width: c.width, height: c.height, bytes: blob.size,
    };
    ctx.log(t("capturedLog", { frame: state.frame, path: state.lastCapture.path }));
    ctx.status(t("captured", { name: resp.name }), "ok");
    return state.lastCapture;
  }

  return { capture };
}
