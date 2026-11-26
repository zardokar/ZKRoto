# Hair-only colour change (zk_hairsplit.js)

## Why (2026-11-26)
- Send with "red hair" on req_20261126_000635 (LK19) left a red band on the skin by the collarbone. Koh 00:52 "แก้ mask แก้เชี่ยไร", 00:53 "แล้วจะต้องไปส่ง sonnet ทำไมถ้าที่ตั้งไว้ผิด", 00:57 "ต้อง proof ได้ว่าใช้ได้กับทุก ภาพ ทุกแบบ".
- Cause: the recipe tinted the WHOLE mark (tint start + paste-back) at denoise 0.6, so every skin pixel under the mark was tinted and pasted back.
- Wrong first answer: Claude told Koh to draw the mark tighter. Koh's mark is position, direction and shape of the colour, not an exact hair outline. The fix belongs in the recipe, never in Koh's mark and never in Sonnet's settings.
- Second step was not general: a fixed cut (green < 0.45, dark hair) works only for dark hair on light skin.

## Method in use (round 1, Otsu)
1. Inside the mark only, the source picture at full size (not the copy sent to Claude).
2. Otsu on each of R, G, B; the channel with the largest `eta x gap` wins.
3. The bigger side is the hair. No clear split (`gap < hairMinGap` 40, `eta < hairMinEta` 0.75, share outside 0.52-0.97) -> `null` = whole mark.
4. The page draws the matte as `hair.png` (white = hair) and uploads it to `input/ZKRoto/req/<id>/hair.png` (ComfyUI `POST /api/upload/image`). Recipe `hairMask: true`: LoadImageMask(hair.png) -> INPAINT_ExpandMask(grow 1, blur 2) -> x expanded mark (multiply LAST, so the soft edge never leaves the mark; review 2026-11-26), used for the tint start AND the paste-back (node 16). Split or upload failure -> whole mark, logged, answer says `hair: whole mark`.
- Send: `zk_hairpixels.js` `hairOf` -> `zk_comfyrun.js` `upload` -> `zk_aisend.js` `hairPart`. Claude's answers: `zkreq.hair(reqId)` in `zkreq/zk_req_browser.js`, then `hairMask: true` when it returned a share.

## Round 2 tried and dropped (2026-11-26)
k-means colours + "same colour family" (hue within 12 degrees, or both grey) joined shine and shadow: it passed the synthetic matrix (144 / 144) but on the real picture req_20261126_000635 it missed 8,604 of 39,689 hair pixels and added 2,536 skin pixels. Reason: this anime hair is plum (80,48,80) with red shading (144,48,48) - 60 degrees of hue inside one hair - and the skin (240,208,208) has the same hue as the red shading. Hue is not a safe sign of "same hair" in anime art.

## Sources (CLAUDE.md 5b)
- Round 1 only - Otsu on R, G, B channels separately for segmentation: Purdue ECE661 HW6 best solutions, https://engineering.purdue.edu/kak/computervision/ECE661_Fall2018/Homeworks/HW6/2BestSolutions/1.pdf
- Round 1 only - Otsu threshold to separate hair from background in portrait correction: US patent 7702149, https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7702149
- Hair vs non-hair colour models seeded from a region the user or a detector gives (foreground / background distributions): US patent 9767586, https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9767586 ; scribble / trimap input for skin-hair segmentation: https://cloudfront.escholarship.org/dist/prd/content/qt1cf194f3/qt1cf194f3.pdf
- Not used (yet): AnimeFace_SemSegPreprocessor (face crops at 512 px, model download), https://comfy.icu/node/AnimeFace_SemSegPreprocessor ; face-parsing hair class, https://comfy.icu/extension/isurulkh__comfyui_face_parsing_New ; ToonOut / isnetis (character vs background, not hair vs skin), https://ice-ice-bear.github.io/posts/2026-04-17-toonout/ . A model is never downloaded automatically (README hard rules).

## Proof - what is proven and what is not
- Real picture req_20261126_000635 (dark plum hair over pale skin, 39,689 hair px): split green, cut 0.524, share 0.939. Same picture inverted (white hair, dark skin), channels swapped, contrast halved, hair lifted to blonde with skin darkened: hair missed 0 / 0 / 0 / 0 / 270 (0.7 %), skin added 0. ComfyUI run with the hair matte: 36,082 of 39,689 hair px turned red, skin under the mark changed 340 of 2,561 px, 11 of them more than 3 px from the hair (round 0, whole mark: 703).
- Stage matrix `D:\repository\ZComfy\.dropzone\atdd\20261126_S3_WIP202611013\hairsplit.test.js` (153 cases): round 1 passes 111, fails 42. NOT proven for every picture. Fails: 2- and 3-tone hair whose tones are as far apart as hair vs skin (blonde + shadow on dark skin, black with white shine, pink + magenta), white hair or green hair with dark lineart at the edge.
- Conclusion: colour alone cannot be proven for every picture (round 1 fails shaded hair, round 2 fails real anime shading). A hair segmentation model is needed for that; none is installed (SAMLoader lists no model, CLIPSeg node only downloads on use). Downloading one needs Koh's OK (README hard rules).

## SAM path (prepared, OFF)
- Why: colour alone cannot be proven for every picture (above). Anime hair is painted as a flat region with its own shading and highlights inside (production order flat colour -> shading -> highlights, https://www.Gwern.net/doc/ai/anime/danbooru/2023-akita.pdf), so a region / object model fits better than colour rules; anime rotoscoping work already uses SAM2 for regions and k-means only for shadows inside them (https://scitepress.org/Papers/2025/133210/133210.pdf).
- Graph (`hairSam: true`, both recipes): SAMLoader(`samModel`) + MaskToSEGS(hair.png, combined) + SAMDetectorCombined(image = src, detection_hint mask-points, no negative points) -> INPAINT_ExpandMask -> x expanded mark. hair.png (the Otsu hair side) only gives the points; SAM returns the hair object, shading included.
- Switch: `web/config/zkroto.json` `ai.hairSam` (false) and `ai.samModel` (`sam_vit_b_01ec64.pth`). Model: https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth into `E:\ComfyUI\ComfyUI\models\sams\` (Koh downloads; README hard rules). NOT run yet: no model on this machine (SAMLoader lists none, checked 2026-11-26). Before turning it on: run the 153-case matrix as pictures through ComfyUI + the real picture.
- Not chosen: GrabCut (colour GMMs + graph cut, https://docs.opencv.org/5.x/d8/d83/tutorial_py_grabcut.html) has the same colour limit inside the mark; lineart-bounded regions fail where strands are split by lines.

## Limits (said to Koh, not hidden)
- A mark that is mostly OFF the hair (more than half on one other colour) picks that colour as "hair". Draw the mark mostly on the hair.
- Hair and what is under the mark in the same colour family (brown hair on tan skin, silver hair on a grey background) cannot be told apart by colour: the whole mark is coloured and the answer says `hair: whole mark`. The fix for these is a hair segmentation model (anime face / face parsing, links above); it needs Koh's OK to download.
- Shaded hair whose light and dark tones are as far apart as hair and skin: Otsu may split the hair itself (see the failing matrix cases).
