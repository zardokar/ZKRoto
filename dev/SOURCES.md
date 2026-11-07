# dev/ - house checkers, copied unchanged

From the AppMaker skill `app-maker-v003` (`appmaker.v003.skill`, `scripts/`), copied 2026-11-07 by Claude at the user's request (ZKRoto follows AppMaker v003 from 0.1.2).

| File | md5 | Job |
|---|---|---|
| `check_style.js` | `129101be648f04e74dd894871556030e` | C1 <=200 lines, one-line functions, comment blocks <=3 lines, line endings per file class, deps, sibling imports |
| `check_style.test.js` | `62950d7b76259e8267ecb6e853dc0eae` | RED proof of check_style |
| `check_blocks.js` | `2fae2a11cb72254917b6176ec9ad1931` | blocks / two statements on one line (what the per-line regex misses) |
| `check_blocks.test.js` | `6d1844575d4ca30e920b5ff7605a812a` | RED proof of check_blocks |

Both checkers read only `.js` (and `.json`, `.md`, `.html`, `.css`, `.bat` for endings and length), so the page scripts are `.js`, not `.mjs`. Update: copy the newer files from the skill and update this table; do not edit them here.
