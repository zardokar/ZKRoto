# ZKRoto page API (`window.zk`)

The page sets `window.zk` while its modules evaluate, as 0.1.1 did: `config/zkroto.json` and `constants/zkroto.json` are static JSON module imports (`import ... with { type: "json" }`), not fetches. If one of them is missing or not valid JSON, the whole module graph fails: the page stays blank and the browser console shows the module load error. Scripts (Claude through the browser pane) drive the page only through these calls.

| Call | Result |
|---|---|
| `zk.load(nameOrUrl)` | name in ComfyUI `input\` (`clip.mp4` or `sub/clip.mp4`), a URL, or a `File`; returns `zk.info()` |
| `zk.seek(n)` | show frame n (0-based, clamped); `{requested, shown, mediaTime}` |
| `zk.step(d)` | seek relative to the last requested frame (fast steps add up) |
| `zk.capture()` | save the shown frame as PNG to `input\ZKRoto\<video>\<video>_f000123.png`; `{frame, path, width, height, bytes, ...}` |
| `zk.pose()` | pose engine (MediaPipe Pose Landmarker) on the shown frame; `{frame, ms, people: [{image: [[x, y, z, vis] x33], world: [[x, y, z] x33]}]}` |
| `zk.info()` | current state, incl. `version` |
| `zk.setFps("30000/1001")` | change the frame grid; returns `zk.info()` |
| `zk.selftest([n...])` | only for `zkroto_test_2997.mp4` (frame number drawn as 16 bit squares); `{total, ok, bad, rows}` |
| `zk.readBits()` | the frame number read from the shown frame of the test video |
| `zk.lastPose` | the last `zk.pose()` result, `null` after a seek |

Query string of the page: `?video=<name in input\>&frame=<n>&fps=30000/1001`.

## Files of the page (`web/`)
| File | Kind | Job |
|---|---|---|
| `js/zk_frames.js` | logical | frame grid, seek time, shown frame, capture names, input URLs |
| `js/zk_bits.js` | logical | decode the test pattern |
| `js/zk_poseshape.js` | logical | engine result -> plain arrays |
| `js/zk_text.js` | logical | `{slot}` message templates |
| `js/zk_context.js` | component | config, constants, DOM elements, state, log, status, page text |
| `js/zk_video.js` | component | load, serialized frame-exact seek, frame canvas, fps grid |
| `js/zk_capture.js` | component | PNG upload through `/api/upload/image` |
| `js/zk_pose.js` | facade | the pose engine (MediaPipe inside) |
| `js/zk_overlay.js` | component | draws the pose over the video |
| `js/zk_selftest.js` | component | selftest on the test video |
| `js/zk_ui.js` | component | buttons, slider, keys, drag and drop |
| `js/zk_main.js` | entry | builds the parts, `window.zk`, query string |
| `config/zkroto.json` | config | every tunable (fps list, timeouts, pose options, test pattern) |
| `constants/zkroto.json` | constants | version, every text on the page and in the log, overlay colours |

`index.html` holds an import map: every page module and both JSON files load as `<file>?v=<version>` (see the README, Version bump).

`mediaTime` from `requestVideoFrameCallback` is the frame start (n/fps) in some browsers and the seek target ((n + 0.5)/fps) in the Claude desktop browser pane, so `shown = floor(mediaTime * fps + 1e-3)` (0.1.0 used round and was +1 in 8/30 frames there), clamped to `total - 1` because after the last frame the video time can snap to the clip end (0.1.3).
