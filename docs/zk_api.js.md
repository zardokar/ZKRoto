# ZKRoto page API (`window.zk`)

The page sets `window.zk` while its modules evaluate, as 0.1.1 did: `config/zkroto.json` and `constants/zkroto.json` are static JSON module imports (`import ... with { type: "json" }`), not fetches. If one of them is missing or not valid JSON, the whole module graph fails: the page stays blank and the browser console shows the module load error. Scripts (Claude through the browser pane) drive the page only through these calls.

| Call | Result |
|---|---|
| `zk.load(nameOrUrl)` | name in ComfyUI `input\` (`clip.mp4` or `sub/clip.mp4`, or a still `front.png`), a URL, or a `File`; a still with `front` in its name also loads its `side` partner (0.2.5); returns `zk.info()` |
| `zk.seek(n)` | show frame n (0-based, clamped); `{requested, shown, mediaTime}` |
| `zk.step(d)` | seek relative to the last requested frame (fast steps add up) |
| `zk.capture()` | save the shown frame as PNG to `input\ZKRoto\capture\<video>\<video>_f000123.png` (0.2: own `capture` folder); `{frame, path, width, height, bytes, ...}` |
| `zk.pose()` | pose engine (MediaPipe Pose Landmarker) on the shown frame, then the face engine on each person's head (0.2.1, if its model is there); `{frame, ms, people: [{image: [[x, y, z, vis] x33], world: [[x, y, z] x33], face: {image: [[x, y, z] x478], size: [w, h]} or null}]}` |
| `zk.info()` | current state, incl. `version`, `still` (a picture, one frame) and `side` (side picture name or null) |
| `zk.setFps("30000/1001")` | change the frame grid; returns `zk.info()` |
| `zk.selftest([n...])` | only for `zkroto_test_2997.mp4` (frame number drawn as 16 bit squares); `{total, ok, bad, rows}` |
| `zk.readBits()` | the frame number read from the shown frame of the test video |
| `zk.lastPose` | the last `zk.pose()` result, `null` after a seek |
| `zk.view("source" \| "pov" \| "split")` | switch the view; `zk.view()` = next view (key V); returns the view |
| `zk.person(0 \| 1)` | the person POV and Export use (person 1 blue, person 2 orange); returns the index |
| `zk.swap()` | exchange person 1 and 2 in this frame (recorded as `swapped`); `{frame, swapped}` |
| `zk.camera({yaw, eyeHeight, distance, fov, roll, lookAt})` | set POV camera values (clamped, yaw wraps); returns the full camera |
| `zk.preset("front" \| "back" \| "left" \| "right" \| "top")` | yaw / eye height presets; returns the camera |
| `zk.layers({op, mp})` | show / hide the OpenPose 18 and MediaPipe 33 layers |
| `zk.names({shot, character})` | the two name fields; files are named `<shot>_<character>_...` |
| `zk.options({...})` | other POV settings: `outMode` (`portrait` / `landscape` / `custom`), `custom: [w, h]`, `framing` (`fit` / `true`), `margins: {top, bottom, sides}` (fractions), `threshold`, `depth` (share of MediaPipe's guessed depth used for POV, 0.05 .. 1, default 0.25), `xy` (`world` = MediaPipe 3D x / y, `image` = x / y from the image points, `sheet` = x / y from the front picture and depth from its side picture), `srcCamera`, `tab`, plus `view`, `person`, `layers`, `names` |
| `zk.povPoints()` | `{op: 18 x [x, y, c], mp: 33 x [x, y, c], face: {op: 70 x [x, y, c], mp: 478 x [x, y, c]} or null, width, height, camera}` in POV pixels of the chosen person, no files; `null` without a pose |
| `zk.exportPose({src})` | Export (Ctrl+E); `src` overrides the "source camera" box; `{frame, folder, files: [paths under input\]}` |
| `zk.exportRange({from, to, src})` | Export every frame from..to (empty = whole clip; a still = frame 0). Pass 1: seek + pose each frame. One fit framing from the POV joints of all frames (`fit` mode only), written as `fit` / `range` into the POV camera of each zkroto frame JSON. Pass 2: seek + export each frame. Sheets once at the end. `{from, to, exported, missing: [frames without the person], stopped, folder, fit}`; holds the Export lock (Ctrl+E waits) |
| `zk.editMode(on)` | Point editing on / off (no argument = toggle, key E); returns the new state |
| `zk.movePoint(i, x, y)` | Move MediaPipe point i (0..32) of the chosen person on the shown frame to x, y video pixels; saves `zkroto\<prefix>_edits.json`; returns the pose |
| `zk.resetPoint(i)` / `zk.resetFrame()` | Point i / every point of the shown frame back to MediaPipe (file saved) |
| `zk.edits()` | The edits document of the shot folder `{version, clip, frames: {frame: {person: {i: [x, y]}}}}` (0..1) |
| `zk.stopRange()` | Stop a running range after the current frame (nothing is written when stopped during the pose pass) |

Query string of the page: `?video=<name in input\>&frame=<n>&fps=30000/1001`.

## Files of the page (`web/`)
Re-skinnable layout (design doc 1.11): logic apart from looks, one folder per component with its own CSS, one theme file, one layout place.

| File | Kind | Job |
|---|---|---|
| `js/zk_frames.js` | logical | frame grid, seek time, shown frame, capture names, input URLs |
| `js/zk_bits.js` | logical | decode the test pattern |
| `js/zk_poseshape.js` | logical | engine result -> plain arrays; `swapPose` |
| `js/zk_text.js` | logical | `{slot}` message templates |
| `js/zk_openpose.js` | logical | MediaPipe 33 -> OpenPose 18, limb list |
| `js/zk_camera.js` | logical | Y up, floor, target, eye, look-at + roll, pinhole projection |
| `js/zk_framing.js` | logical | `fit` on the margins / `true` camera |
| `js/zk_outsize.js` | logical | Portrait / Landscape 832 x 1216, Custom x64 + 1 MP warning |
| `js/zk_naming.js` | logical | `<shot>_<character>` prefix, camera name, file names, sub-folders, capture folder |
| `js/zk_posejson.js` | logical | OpenPose JSON, MediaPipe JSON, zkroto frame JSON, shot index |
| `js/zk_sheetlayout.js` | logical | grid of the MediaPipe sheet |
| `js/zk_povstate.js` | logical | POV settings: defaults, clamps, presets, orbit, views, options |
| `js/zk_pov.js` | logical | one person -> both layers for the source or the POV camera |
| `js/zk_events.js` | logical | event bus (`zk:pov`, `zk:pose`) |
| `js/zk_skeleton.js` | draw | OpenPose 18 / MediaPipe 33 on any 2D context |
| `js/zk_render.js` | draw | off-screen OpenPose PNG and MediaPipe sheet |
| `js/zk_exporter.js` | service | Export: files, `POST /zkroto/export`, sheets |
| `js/zk_povapi.js` | facade | POV settings + chosen person; announces every change on the bus |
| `js/zk_api.js` | facade | builds the parts and `window.zk` |
| `js/zk_layout.js` | layout | puts components into the page slots (config `layout`), loads their CSS, view and tab switching |
| `js/zk_dom.js` | view helper | element builders for components |
| `js/zk_context.js` | component | config, constants, DOM elements, state, log, status, `run`, bus |
| `js/zk_video.js` | component | load, serialized frame-exact seek, frame canvas, fps grid |
| `js/zk_capture.js` | component | PNG upload through `/api/upload/image` |
| `js/zk_pose.js` | facade | the pose engine (MediaPipe inside) |
| `js/zk_face.js` | facade | the face engine (MediaPipe Face Landmarker on a head crop of each person) |
| `js/zk_facecrop.js` | logical | head crop from the pose points, crop -> frame coordinates |
| `js/zk_openface.js` | logical | MediaPipe face 478 -> OpenPose face 70 |
| `js/zk_facefit.js` | logical | face mesh into the body's world (own shape, torso scale, image position, nose depth); face direction, head centre |
| `js/zk_overlay.js` | component | draws the pose over the video (chosen person solid, other faded) |
| `js/zk_selftest.js` | component | selftest on the test video |
| `js/zk_ui.js` | component | buttons, slider, keys (C, P, V, Ctrl+E, arrows), drag and drop |
| `js/zk_main.js` | entry | context, API, layout, `window.zk`, query string |
| `components/<name>/<name>.js + .css` | component | `people`, `views`, `tabs`, `povview`, `povpanel` (+ `povpanel_fields.js`), `minimap`, `points`, `exportbar`; each exports `mount(host, ctx, parts)` |
| `components/registry.js` | layout | the components the layout can place |
| `theme/zk_theme.css` | theme | every colour, size, space and font as CSS variables |
| `layout/zk_page.css` | layout | page frame, slots, the three views (variables only) |
| `config/zkroto.json` | config | every tunable (fps list, timeouts, pose options, test pattern, POV defaults / ranges / presets, size, margins, sheet, export routes, layout) |
| `constants/zkroto.json` | constants | version, every text, canvas colours (people, OpenPose 18, sheet, minimap), MediaPipe connections and joint names |

How to change the look: colours and sizes in `theme/zk_theme.css`; where a component sits in `config.layout.slots` / `config.layout.tabs`; a component's own look in its CSS. Remove a component: its folder, its line in `components/registry.js`, its name in `config.layout`. Canvas drawings take their colours from `constants.colors` (the person colours must equal `--zk-person-1/2`; a test checks it).

## Export (Ctrl+E)
Writes through `POST /zkroto/export` (rules in `zk_export.py`) into `input\ZKRoto\<shot>_<character>\`: `openpose\src|pov\` PNG + JSON, `mediapipe\src|pov\` JSON, `mediapipe\<prefix>_sheet_<camera>.png`, `zkroto\<prefix>_f000123.json` and `zkroto\<prefix>_shot.json`; with a face (0.2.1) also `openpose\face\src|pov\` PNG + JSON (`face_keypoints_2d`, 70 points) and `mediapipe\face\src|pov\` JSON (478 points + world), same file names as the body; always (0.2.8) `openpose\full\src|pov\` PNG = body 18 + face 70 on one canvas (body only without a face), same file name as the body PNG. Reads back with `GET /zkroto/shot?folder=&frame=` (shot index + frame record, to merge) and `GET /zkroto/sheetdata?folder=&camera=` (MediaPipe JSON of every exported frame of one camera, for the sheet). Camera name `pov_y035_h155_d120_f60` (+ `_r10` / `_rm10`, `_L`, `_c<W>x<H>` for Custom). Names: letters, digits and `-`; anything else becomes `-` (an empty shot = the clip name, e.g. `zkroto-test-fra007`).

`index.html` holds an import map: every page module and both JSON files load as `<file>?v=<version>` (see the README, Version bump).

`mediaTime` from `requestVideoFrameCallback` is the frame start (n/fps) in some browsers and the seek target ((n + 0.5)/fps) in the Claude desktop browser pane, so `shown = floor(mediaTime * fps + 1e-3)` (0.1.0 used round and was +1 in 8/30 frames there), clamped to `total - 1` because after the last frame the video time can snap to the clip end (0.1.3).
