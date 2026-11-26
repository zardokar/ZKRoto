// LOGICAL (pure): the zk req recipe on the page, a copy of the ZComfy skill script scripts/zkreq/zk_req_prompt.js
// (inpaint in the mask, ControlNet union anime lineart keeps the shape, tint start for colours). Parity with that
// script: atdd/fixtures/reqrecipe_parity.json. Change both together. Sources: ZComfy .dropzone/lab/20261124_zkreq/.
export const ADULT_POS = "adult woman, mature female, anime style, masterpiece, best quality";
export const ADULT_NEG = "loli, child, young, lowres, bad anatomy, blurry, watermark, text, paint stroke";
export const EXTRA_NEG = "earrings, jewelry, hair ornament";
const ID_RE = /^req_[0-9]{8}_[0-9]{6}$/;
const DEFAULTS = { denoise: 0.95, steps: 30, cfg: 5, grow: 4, blur: 6, minSide: 1024, keepShape: true,
  shapeStrength: 0.8, shapeEnd: 0.8, tint: null, tintAmount: 0.55, controlnet: "diffusion_pytorch_model_promax.safetensors",
  ckpt: "waiIllustriousSDXL_v170.safetensors", sampler: "dpmpp_2m_sde", scheduler: "karras", hairOnly: true,
  hairMask: false, hairGrow: 1, hairBlur: 2, hairSam: false, samModel: "sam_vit_b_01ec64.pth" };

function to8(x) {
  return Math.max(8, Math.round(x / 8) * 8);
}

// Work size: short side >= minSide and both sides multiples of 8 (InpaintModelConditioning crops to 8, which
// would shift the composite); null when the picture already fits (review 2026-11-24, finding 1).
function workSize(w, h, minSide) {
  const f = Math.max(1, minSide / Math.min(w, h));
  const s = { w: to8(w * f), h: to8(h * f) };
  return s.w === w && s.h === h ? null : s;
}

function check(o) {
  for (const k of ["width", "height"]) {
    if (!Number.isInteger(o[k]) || o[k] <= 0) throw new Error(k + " must be a positive whole number: " + o[k]);
  }
  if (!Number.isInteger(o.seed)) throw new Error("seed must be a whole number: " + o.seed);
  for (const k of ["denoise", "shapeStrength", "shapeEnd", "tintAmount", "grow", "blur", "cfg", "steps", "minSide",
    "hairGrow", "hairBlur"]) {
    if (!Number.isFinite(o[k])) throw new Error(k + " must be a finite number: " + o[k]);
  }
  if (o.tint !== null && !/^#[0-9a-f]{6}$/i.test(o.tint)) throw new Error("tint must be #rrggbb: " + o.tint);
}

// The source's own lines (anime lineart) through ControlNet union keep the hair's shape; returns [positive, negative].
function holdShape(p, o, pixels) {
  p[18] = { class_type: "ControlNetLoader", inputs: { control_net_name: o.controlnet } };
  p[19] = { class_type: "SetUnionControlNetType", inputs: { control_net: ["18", 0], type: "canny/lineart/anime_lineart/mlsd" } };
  p[20] = { class_type: "AnimeLineArtPreprocessor", inputs: { image: pixels, resolution: 1024 } };
  p[21] = { class_type: "ControlNetApplyAdvanced", inputs: { positive: ["10", 0], negative: ["11", 0],
    control_net: ["19", 0], image: ["20", 0], strength: o.shapeStrength, start_percent: 0, end_percent: o.shapeEnd } };
  return [["21", 0], ["21", 1]];
}

// A colour change keeps the shape best when the masked area STARTS from a tint of the wanted colour (only a start:
// SDXL redraws it at denoise 0.6; the lines still come from the untinted picture). Run 2026-11-24 23:5x: tint +
// lock = shape 0.53, red 49.5 % vs lock alone 0.51 / 13 % (D:\repository\ZComfy\.dropzone\zkreq\20261124_2342_shape_lock).
function tintStart(p, o, pixels, mask, size) {
  if (!/^#[0-9a-f]{6}$/i.test(o.tint)) {
    throw new Error("tint must be #rrggbb: " + o.tint);
  }
  p[30] = { class_type: "EmptyImage", inputs: { width: size.w, height: size.h, batch_size: 1,
    color: parseInt(o.tint.slice(1), 16) } };
  p[31] = { class_type: "ImageBlend", inputs: { image1: pixels, image2: ["30", 0], blend_factor: o.tintAmount,
    blend_mode: "normal" } };
  p[32] = { class_type: "ImageCompositeMasked", inputs: { destination: pixels, source: ["31", 0], x: 0, y: 0,
    resize_source: false, mask } };
  return ["32", 0];
}

// Colour change, hair only (Koh 2026-11-26 00:09 red band on skin): hairMask = the page uploaded hair.png (zk_hairsplit.js)
// into the request folder; matte = mark x hair.png. Tint and paste-back use it, so skin / clothes under the mark never change.
// SAM (prepared, OFF until Koh downloads the model): points from hair.png -> the whole hair object, shading included.
function samHair(p, o) {
  p[50] = { class_type: "SAMLoader", inputs: { model_name: o.samModel, device_mode: "AUTO" } };
  p[51] = { class_type: "MaskToSEGS", inputs: { mask: ["40", 0], combined: true, crop_factor: 3, bbox_fill: false, drop_size: 10,
    contour_fill: false } };
  p[52] = { class_type: "SAMDetectorCombined", inputs: { sam_model: ["50", 0], segs: ["51", 0], image: ["2", 0],
    detection_hint: "mask-points", dilation: 0, threshold: 0.93, bbox_expansion: 0, mask_hint_threshold: 0.7,
    mask_hint_use_negative: "False" } };
  return ["52", 0];
}

function hairMatte(p, o, dir) {
  p[40] = { class_type: "LoadImageMask", inputs: { image: dir + "hair.png", channel: "red" } };
  const seed = o.hairSam ? samHair(p, o) : ["40", 0];
  p[41] = { class_type: "INPAINT_ExpandMask", inputs: { mask: seed, grow: o.hairGrow, blur: o.hairBlur, blur_type: "gaussian" } };
  // Multiply LAST, so the soft edge never leaves the (expanded) mark (review 2026-11-26).
  p[43] = { class_type: "MaskComposite", inputs: { destination: ["4", 0], source: ["41", 0], x: 0, y: 0, operation: "multiply" } };
  return ["43", 0];
}

// The hair matte at the work size of a small picture (same steps as the mark, nodes 6-8).
function scaledMatte(p, matte, big) {
  p[45] = { class_type: "MaskToImage", inputs: { mask: matte } };
  p[46] = { class_type: "ImageScale", inputs: { image: ["45", 0], upscale_method: "bilinear", width: big.w, height: big.h,
    crop: "disabled" } };
  p[47] = { class_type: "ImageToMask", inputs: { image: ["46", 0], channel: "red" } };
  return ["47", 0];
}

export function buildPrompt(input) {
  const given = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const o = Object.assign({}, DEFAULTS, given.tint ? { denoise: 0.6 } : {}, given);
  check(o);
  if (typeof o.hairMask !== "boolean") {
    throw new Error("bad hairMask: " + o.hairMask);
  }
  if (typeof o.hairSam !== "boolean") {
    throw new Error("bad hairSam: " + o.hairSam);
  }
  if (typeof o.samModel !== "string" || !o.samModel) {
    throw new Error("bad samModel: " + o.samModel);
  }
  if (!ID_RE.test(o.id)) {
    throw new Error("bad request id: " + o.id);
  }
  const dir = "ZKRoto/req/" + o.id + "/";
  const p = {
    1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: o.ckpt } },
    2: { class_type: "LoadImage", inputs: { image: dir + "src.png" } },
    3: { class_type: "LoadImageMask", inputs: { image: dir + "mask.png", channel: "red" } },
    4: { class_type: "INPAINT_ExpandMask", inputs: { mask: ["3", 0], grow: o.grow, blur: o.blur, blur_type: "gaussian" } },
    9: { class_type: "DifferentialDiffusion", inputs: { model: ["1", 0] } },
    10: { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: o.prompt + ", " + ADULT_POS } },
    11: { class_type: "CLIPTextEncode", inputs: { clip: ["1", 1], text: ADULT_NEG + ", " + EXTRA_NEG } },
  };
  let pixels = ["2", 0];
  let mask = ["4", 0];
  const big = workSize(o.width, o.height, o.minSide);
  if (big) {
    p[5] = { class_type: "ImageScale", inputs: { image: ["2", 0], upscale_method: "lanczos", width: big.w, height: big.h,
      crop: "disabled" } };
    p[6] = { class_type: "MaskToImage", inputs: { mask: ["4", 0] } };
    p[7] = { class_type: "ImageScale", inputs: { image: ["6", 0], upscale_method: "bilinear", width: big.w, height: big.h,
      crop: "disabled" } };
    p[8] = { class_type: "ImageToMask", inputs: { image: ["7", 0], channel: "red" } };
    pixels = ["5", 0];
    mask = ["8", 0];
  }
  const cond = o.keepShape ? holdShape(p, o, pixels) : [["10", 0], ["11", 0]];
  const hair = o.tint !== null && o.hairOnly && o.hairMask ? hairMatte(p, o, dir) : null;
  const hairWork = hair && big ? scaledMatte(p, hair, big) : hair;
  const start = o.tint !== null ? tintStart(p, o, pixels, hairWork || mask, big || { w: o.width, h: o.height }) : pixels;
  p[12] = { class_type: "InpaintModelConditioning", inputs: { positive: cond[0], negative: cond[1], vae: ["1", 2],
    pixels: start, mask, noise_mask: true } };
  p[13] = { class_type: "KSampler", inputs: { model: ["9", 0], seed: o.seed, steps: o.steps, cfg: o.cfg,
    sampler_name: o.sampler, scheduler: o.scheduler, positive: ["12", 0], negative: ["12", 1], latent_image: ["12", 2],
    denoise: o.denoise } };
  p[14] = { class_type: "VAEDecode", inputs: { samples: ["13", 0], vae: ["1", 2] } };
  let result = ["14", 0];
  if (big) {
    p[15] = { class_type: "ImageScale", inputs: { image: ["14", 0], upscale_method: "lanczos", width: o.width,
      height: o.height, crop: "disabled" } };
    result = ["15", 0];
  }
  p[16] = { class_type: "ImageCompositeMasked", inputs: { destination: ["2", 0], source: result, x: 0, y: 0,
    resize_source: false, mask: hair || ["4", 0] } };
  p[17] = { class_type: "SaveImage", inputs: { images: ["16", 0], filename_prefix: "ZKRoto_req/" + o.id + "_s" + o.seed } };
  return p;
}
