# Vector with pen tools - method notes (for the ZKRoto pen tool)

Written 2026-11-24 for Koh ("จดเรื่องการทำ vector ด้วย Pen Tools", 01:51). Sources read in this session:
- PenVec 1.00 (2012, Koh's own C# tool): `E:\LocalLLMAdvisorClaudeProject\.dropzone\PenVec.ver.1.00.2012.03.28\PenVec\`
- Curvature Tool clip: `docs/outhtm/20220125_The-Easiest-Way-To-Make-Curved-Lines-In-Illustrator.html` (+ `docs/aimd/..._claude.md`)
- Swoosh clip: `docs/outhtm/20220531_How-To-Make-Perfect-Curved-Swooshes-In-Illustrator-Without-Pen-Tool.html` (+ `_claude.md`)
- LK19 trial with these ideas: ComfyUIAssistant `.dropzone\lk19_sdxl_route\20261124_0148_vector_swoosh\` (vec.py, notes.md)

## 1. Three ways to make a curve
| way | what the user does | what the program does | good for |
|---|---|---|---|
| Polyline (PenVec) | click points | straight segments; click the first point = closed polygon | masks, rough shapes |
| Curvature (Illustrator Curvature Tool) | click points only | a smooth curve THROUGH every point (each point's neighbours adjust); Alt+click = corner point; Alt+Shift = straight segment locked to 0/90 deg; closing keeps the joint smooth; a live preview segment follows the mouse | hair strands, outlines traced over a picture |
| Bezier (Pen Tool) | click = corner, click-drag = smooth point with two mirrored handles | cubic Bezier per segment from the anchors and handles | exact control, logos |

Implementation note (curvature): centripetal Catmull-Rom (alpha 0.5) through the anchors, converted to cubic Bezier per segment (B1 = P1 + (P2 - P0)/6, B2 = P2 - (P3 - P1)/6 for the uniform case; centripetal uses the knot spacing). It never overshoots into loops on uneven spacing. A corner anchor splits the curve: each side is fitted on its own.

## 2. Shapes from overlapping curves (swoosh clip)
- A crescent / swoosh = ellipse A minus a slightly shifted copy of A (Illustrator Pathfinder > Minus Front). Both edges come from smooth curves, both ends taper by themselves.
- The shape is controlled by three knobs: the tilt / fatness of the ellipse (Shear), the offset of the copy (dX, dY; e.g. 35.64 / -19.44 px), and a Shear of the finished shape.
- Rotate + Copy around a centre with angle 360/n gives n equal pieces in a ring.

## 3. A hair strand as a vector
- Centre line: 3-6 curvature anchors placed by eye along ONE strand (between two ink lines).
- Body: offset the centre line by +-w(u)/2 with a width profile that tapers at both ends. Used in the LK19 trial: w(u) = wmax * min((u/0.2)^0.7, ((1-u)/0.45)^1.6) - the root fades in, the tip is a long sharp taper (Koh 01:50: "เส้นผมมันต้องดูที่ปลายด้วย ไม่ใช่จบเป็นแท่งๆ").
- Draw it UNDER the line art: ink pixels stay on top. Colour = one card colour ramped by the hair's own luminance so the shading shows through.
- Render with supersampling (4x) and downscale for clean anti-aliased edges.

## 4. What the LK19 trial showed (2026-11-24 01:48, independent review FAIL)
- Worked: pointed tapered ends, smooth curves, no red on ink / skin / tie, all rule checks PASS.
- Failed: paths chosen by a search did not follow one strand on screen (ponytail streaks crossed curls); capping the width by the distance to ink and cutting under ink broke thin streaks into pieces; repainting the kept S1 band left a black patch and a stair-stepped edge.
- Lesson: the anchors must be placed by a person who sees the strand (pen tool), and the width cap must not split a streak; numbers that pass with a picture that looks wrong = FAIL.

## 5. What the ZKRoto pen tool needs from this
Curvature draw (default) + Bezier handles on drag, Alt corner, Alt+Shift axis lock, live preview, click first point to close (smooth), Enter for an open path, move point / move path (PenVec A / V), a per-path width profile (taper root / tip), stroke under the line art, SVG + JSON save. Later: boolean minus (swoosh), rotate-copy.
