// FACADE for the pose engine. Outside code calls only createPose(...).pose() / .connections();
// MediaPipe Pose Landmarker is the engine inside (third-party\mediapipe, served at /<slug>_lib/mediapipe).
import { shapePose } from "./zk_poseshape.js";

export function createPose(ctx, video, hooks) {
  const { cfg, k, state, t } = ctx;
  const slug = location.pathname.split("/")[1] || k.app.toLowerCase();
  const base = `/${slug}_lib/mediapipe`;
  const model = `${base}/${cfg.pose.model}`;
  let landmarker = null;
  let connections = [];

  function options(delegate) {
    const p = cfg.pose;
    return {
      baseOptions: { modelAssetPath: model, delegate },
      runningMode: p.runningMode,
      numPoses: p.numPoses,
      minPoseDetectionConfidence: p.minPoseDetectionConfidence,
      minPosePresenceConfidence: p.minPosePresenceConfidence,
    };
  }

  async function create(PoseLandmarker, fileset) {
    const list = cfg.pose.delegates;
    for (let i = 0; i < list.length; i += 1) {
      try {
        const lm = await PoseLandmarker.createFromOptions(fileset, options(list[i]));
        ctx.log(t("poseReady", { delegate: list[i] }));
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

  async function ensure() {
    if (landmarker) {
      return landmarker;
    }
    ctx.status(t("loadingPose"));
    const { FilesetResolver, PoseLandmarker } = await import(`${base}/${cfg.pose.bundle}`);
    connections = PoseLandmarker.POSE_CONNECTIONS || [];
    const head = await fetch(model, { method: "HEAD" });
    if (!head.ok) {
      throw new Error(t("modelMissing", { app: k.app, status: head.status }));
    }
    const fileset = await FilesetResolver.forVisionTasks(`${base}/${cfg.pose.wasm}`);
    landmarker = await create(PoseLandmarker, fileset);
    return landmarker;
  }

  // Any canvas (the shown frame, or a character sheet's side picture) -> shaped pose.
  async function detect(c, frame) {
    const lm = await ensure();
    const t0 = performance.now();
    const res = lm.detect(c);
    return shapePose(res, { frame, width: c.width, height: c.height, ms: performance.now() - t0 });
  }

  async function pose() {
    if (!state.url) {
      throw new Error(t("noVideo"));
    }
    state.lastPose = await detect(video.frameCanvas(), state.frame);
    hooks.onPose();
    const n = state.lastPose.people.length;
    ctx.status(t("pose", { n, ms: state.lastPose.ms }), "ok");
    ctx.log(t("poseLog", { frame: state.frame, n }));
    return state.lastPose;
  }

  return {
    pose,
    detect,
    connections: function () {
      return connections;
    },
  };
}
