# Third-party files in ZKRoto

**Not in the git repo** (user, 2026-11-07: "เก็บแค่ NOTICE.md"): `third-party/mediapipe/` is ignored by `.gitignore`. A working copy is in `E:\ComfyUI\ComfyUI\custom_nodes\ZKRoto\third-party\`; for a new install get the files from the sources below and check the sha256 values.

## mediapipe/tasks-vision/ - MediaPipe Tasks Vision (Google)
- Package: `@mediapipe/tasks-vision` **1.2.2** from the npm registry (published 2026-11-03 by Google's MediaPipe team; maintainers on `@google.com` addresses), homepage http://mediapipe.dev
- License: **Apache-2.0** (field `license` in `mediapipe/tasks-vision/package.json`; full text: https://www.apache.org/licenses/LICENSE-2.0)
- Copied unchanged, only the files the page needs:

| File | sha256 |
|---|---|
| `vision_bundle.mjs` | `b65acb59b370cd6561afd9d04c29ed7a87e7ed6386922ac1b263af1f1ad06b7d` |
| `wasm/vision_wasm_internal.js` | `f2b9c17131ea79716ec6bf07b117a087b2749a6f8a1e2f1f2e77a9382092db5b` |
| `wasm/vision_wasm_internal.wasm` | `f5bd25147ac89d506074293ce2675969b10e827180db95a0d9689c2ed80764ab` |
| `package.json` | (as published) |

- Checked 2026-11-07: the bundle and wasm loader contain no network endpoints other than links in comments; everything loads from this folder.
- To update: `npm pack @mediapipe/tasks-vision@<version>`, copy the same four files, update this table.

## mediapipe/models/ - MediaPipe Pose Landmarker model
- `pose_landmarker_full.task` from Google's official bucket:
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
- Model card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf (check the terms there; used only to read poses, not part of any output image)
- Copied into `mediapipe/models/` on 2026-11-07 at the user's request (downloaded from the URL above, unchanged); sha256 `4eaa5eb7a98365221087693fcc286334cf0858e2eb6e15b506aa4a7ecdcec4ad`, 9,398,198 bytes.
