# ZKRoto 0.1.3

Frame-exact video viewer, frame capture and pose page for ComfyUI, written for the ComfyUIAssistant project (user `zardokar`). It adds no nodes and injects nothing into the ComfyUI UI: it only serves its own page.

- Page: `http://127.0.0.1:8188/zkroto/` (optional query: `?video=<name in input\>&frame=<n>&fps=30000/1001`)
- Library files: `/zkroto_lib/` (= `third-party/`, MediaPipe under `third-party/mediapipe/`)
- Version check: `/zkroto/version` (the Python side; it changes only after a ComfyUI restart)
- Script API for Claude through the browser pane: `window.zk`, see [docs/zk_api.js.md](docs/zk_api.js.md)

## Rules for any AI working here
- Code follows **AppMaker v003** (`app-maker-v003`, from 0.1.2): files <=200 lines split by category, no one-line functions, one statement per line, comments <=3 lines (overflow to `docs/<file>.md`), settings at the top of every file, every text in `web/constants/zkroto.json`, every tunable in `web/config/zkroto.json`, logical (pure) and component code in separate files, the pose engine behind the facade `web/js/zk_pose.js`.
- Order for every change: analyse -> design -> unit tests first (seen RED) -> code -> `atdd\all_test.bat` + `batch\check_style.bat` both PASS -> before / after check in the real ComfyUI -> review.
- Only pose / joints are taken from a clip, never a real person's face, identity or distinctive marks. Characters made from it are original adults.
- No automatic install, download or spend. Claude does not run git, npm or `.bat` files on the user's machine; the user commits and pushes.
- Two copies (user, 2026-11-07, Q6 = a): this repo is the source of record; the same files are written to `E:\ComfyUI\ComfyUI\custom_nodes\ZKRoto\` and byte-compared after each change.
- Third-party binaries are not in git (Q7): see [third-party/NOTICE.md](third-party/NOTICE.md).

## What it does
- Loads an mp4 from ComfyUI `input\` (name, or `subfolder/name`) or a local file (picker or drag and drop).
- Steps frame by frame (buttons, slider, arrow keys, Shift = 10 frames). Default 29.97 fps (`30000/1001`); other rates in the fps list.
- Seeks to the middle of frame n and confirms the frame shown with `requestVideoFrameCallback`.
- **Capture (C)** saves the shown frame as PNG through ComfyUI's `/upload/image` to `input\ZKRoto\<video>\<video>_f000123.png` (overwrites the same frame).
- **Pose (P)** runs MediaPipe Pose Landmarker on the shown frame (up to 2 people): 33 image and 33 world landmarks, drawn as an overlay, kept in `zk.lastPose`.

## Files
```
__init__.py                 routes /zkroto and /zkroto/ (redirect to index.html, query kept), /zkroto/version, static /zkroto/ and /zkroto_lib/
web/index.html              page (no text inside: data-text keys -> constants)
web/package.json            {"type": "module"} so Node tests can import the page scripts
web/js/*.js                 page scripts, one job per file (table in docs/zk_api.js.md)
web/config/zkroto.json      tunables
web/constants/zkroto.json   version, texts, colours
atdd/*.test.js              unit tests, start-up test, version test, style gate (node --test); atdd\all_test.bat runs them all
atdd/fake_dom.js            test helper: fake DOM built from web/index.html
dev/                        house checkers copied from the skill (dev/SOURCES.md)
batch/check_style.bat       runs both checkers
batch/commit.bat            the user commits: shows the changes and MSG (<=120 chars, set in the file), asks Y/N, then asks about push
docs/                       notes that do not fit in code comments
third-party/NOTICE.md       sources, licences, sha256 of the MediaPipe files (files themselves not in git)
```

## Browser
The page loads its JSON with import attributes (`with { type: "json" }`): Chromium 123+ (Chrome, Edge, the Claude desktop browser pane), Safari 17.2+, Firefox 138+. Older browsers show a blank page.

## If the page stays blank
`web/config/zkroto.json` and `web/constants/zkroto.json` are loaded as JSON modules together with the scripts. A missing file or a JSON typo stops the whole page; the browser console (F12) names the file. Check both with any JSON validator.

## Tests
- `atdd\all_test.bat` (double-click; `node --test` from the repo root): frame grid, shown frame for both `mediaTime` styles on 300 frames, names, URLs, bit decoding, pose shaping, message templates, both checkers at 0 findings, and the checkers' own tests.
- `batch\check_style.bat`: the two checkers alone, printing `file:line`.
- In the real ComfyUI (browser pane): `zk.selftest()` on `input\zkroto_test_2997.mp4` (frame number drawn as 16 bit squares), capture of frame 123, `zk.pose()` on `input\zkroto_test_fra007.mp4`.

## History
- 0.1.0 (2026-11-07): viewer, frame-exact seek, capture, MediaPipe Pose; tested headless against a stand-in server.
- 0.1.1 (2026-11-07): live in ComfyUI 0.39.0; fixed `/zkroto/` 403, query lost on redirect, `shown` +1 in the browser pane (round -> floor).
- 0.1.2 (2026-11-07): same behaviour, rewritten to AppMaker v003 (split into 12 page scripts, JSON config and constants, unit tests, checkers); `.mjs` -> `.js`; source moved to `D:\repository\ZKRoto`.
- 0.1.3 (2026-11-07): import map with `?v=` for every page module and JSON; `shown` clamped to the last frame (a second seek to the last frame said 300); runtime test that `window.zk` is ready when the modules have evaluated (`atdd/zk_ready.test.js` with `atdd/fake_dom.js`).

## Version bump
One version in five places, checked by `atdd/zk_version.test.js`: `web/constants/zkroto.json` `version`, `__init__.py` `VERSION` (shows at `/zkroto/version` only after a ComfyUI restart), the entry `js/zk_main.js?v=` and every value of the import map in `web/index.html`, and the title of this README. The import map makes the browser load every page module and both JSON files as `<file>?v=<version>`, so a bump never mixes old and new files. A new page module needs an import-map line (the test fails without it).

## Planned
Open: the GPU -> CPU fallback of MediaPipe has not been run on a machine without GPU. Known limit of `atdd/zk_ready.test.js`: an `await` that only takes a microtask (an already resolved value) still passes it; waiting for a fetch, a timer or a top-level await fails it (review 2026-11-07).

0.2: POV camera on the 3D pose -> OpenPose-style skeleton PNG + pose JSON for ComfyUI ControlNet; engine slot in `zk_pose.js`. Later: joint editing, frame-to-frame smoothing.
