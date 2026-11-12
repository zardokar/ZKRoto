// FACADE for the face engine (design 1.12): MediaPipe Face Landmarker on a head crop of every pose person.
// attach(pose, frame) adds person.face = { image: 478 x [x, y, z] normalized to the frame, size: [W, H] }.
import { headCrop, cropToFrame } from "./zk_facecrop.js";

export function createFace(ctx) {
  const { cfg, k, t } = ctx;
  const slug = location.pathname.split("/")[1] || k.app.toLowerCase();
  const base = `/${slug}_lib/mediapipe`;
  const model = `${base}/${cfg.face.model}`;
  let landmarker = null;
  let missing = false;

  function options(delegate) {
    const f = cfg.face;
    return {
      baseOptions: { modelAssetPath: model, delegate }, runningMode: f.runningMode, numFaces: f.numFaces,
      minFaceDetectionConfidence: f.minFaceDetectionConfidence, minFacePresenceConfidence: f.minFacePresenceConfidence,
    };
  }

  async function create(FaceLandmarker, fileset) {
    const list = cfg.face.delegates;
    for (let i = 0; i < list.length; i += 1) {
      try {
        const lm = await FaceLandmarker.createFromOptions(fileset, options(list[i]));
        ctx.log(t("faceReady", { delegate: list[i] }));
        return lm;
      } catch (e) {
        if (i === list.length - 1) {
          throw e;
        }
        ctx.log(t("delegateFailed", { delegate: list[i], next: list[i + 1], message: e.message }));
      }
    }
    return null;
  }

  // null when the model file is not there (said once in the log; ZKRoto then works with the body only)
  async function ensure() {
    if (landmarker || missing) {
      return landmarker;
    }
    const head = await fetch(model, { method: "HEAD" });
    if (!head.ok) {
      missing = true;
      ctx.log(t("faceMissing", { app: k.app }));
      return null;
    }
    const { FilesetResolver, FaceLandmarker } = await import(`${base}/${cfg.pose.bundle}`);
    const fileset = await FilesetResolver.forVisionTasks(`${base}/${cfg.pose.wasm}`);
    landmarker = await create(FaceLandmarker, fileset);
    return landmarker;
  }

  function detectOne(fl, person, frame, crop) {
    const box = headCrop(person.image, frame.width, frame.height, cfg.face.cropScale);
    const g = crop.getContext("2d");
    g.clearRect(0, 0, crop.width, crop.height);
    g.drawImage(frame, box.x, box.y, box.size, box.size, 0, 0, crop.width, crop.height);
    const found = fl.detect(crop).faceLandmarks[0];
    if (!found) {
      return null;
    }
    const pts = found.map(function (q) {
      return [q.x, q.y, q.z];
    });
    return { image: cropToFrame(pts, box, frame.width, frame.height), size: [frame.width, frame.height] };
  }

  async function attach(pose, frame) {
    const fl = await ensure();
    if (!fl || !pose) {
      return 0;
    }
    const crop = document.createElement("canvas");
    crop.width = cfg.face.cropPixels;
    crop.height = cfg.face.cropPixels;
    let n = 0;
    for (const person of pose.people) {
      person.face = detectOne(fl, person, frame, crop);
      n += person.face ? 1 : 0;
    }
    ctx.log(t("faceLog", { frame: pose.frame, n, people: pose.people.length }));
    return n;
  }

  return { attach };
}
