// COMPONENT: character sheet side picture (user choice B, 2026-11-10 voice). When a still whose file name has
// "front" is loaded, the picture with "side" in its place (same folder) is read and posed once; POV then takes
// its depth from it (pov.xy "sheet", zk_sheet.js). No side picture -> nothing changes.
import * as F from "./zk_frames.js";

function picture(url) {
  return new Promise(function (resolve) {
    const img = new Image();
    img.onload = function () {
      resolve(img);
    };
    img.onerror = function () {
      resolve(null);
    };
    img.src = url;
  });
}

export function createSidePic(ctx, pose, povApi) {
  const { state, t } = ctx;

  // Back to the default x / y source if the sheet one was on; always tells the panel (its button hides).
  function none() {
    state.side = null;
    povApi.options(state.pov && state.pov.xy === "sheet" ? { xy: ctx.cfg.pov.xy } : {});
    return null;
  }

  async function find(src) {
    none();
    const name = src instanceof File || !state.still ? null : F.sideName(String(src));
    if (!name) {
      return null;
    }
    const img = await picture(F.isUrl(name) ? name : F.inputUrl(name));
    if (!img) {
      ctx.log(t("sideNone", { name }));
      return none();
    }
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    const p = await pose.detect(c, 0);
    if (!p.people.length) {
      ctx.log(t("sideNoPose", { name }));
      return none();
    }
    state.side = { name, person: p.people[0], width: c.width, height: c.height };
    povApi.options({ xy: "sheet" });
    ctx.log(t("sideFound", { name }));
    return state.side;
  }

  return { find };
}
