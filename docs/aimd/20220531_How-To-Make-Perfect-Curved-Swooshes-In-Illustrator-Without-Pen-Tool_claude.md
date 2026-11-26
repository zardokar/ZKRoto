# How to Make Perfect Curved Swooshes in Illustrator (Without Pen Tool!) - Claude Context
> Source: YouTube video "How to Make Perfect Curved Swooshes in Illustrator (Without Pen Tool!)", CreativeAlys, 2022-05-31, 10:00, no speech and no captions (music only); read from the frames, on-screen text and the description's chapter list · https://www.youtube.com/watch?v=mUxPKlBLmWo · Generated: 2026-11-24
> Companion: 20220531_How-To-Make-Perfect-Curved-Swooshes-In-Illustrator-Without-Pen-Tool.html (Thai, iw mode `iw`, 9 sections, 23 frames + 7 own SVG)

## Processing Notes
- Mode: `iw`. Body: own-words rewrite (standard YouTube license); no transcript exists, every statement comes from what the frames show.
- Frames used: P01, P02, P03, P04, P05, P06, P07, P08, P09, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22, P23.
- Own SVG diagrams: flow, flow, compare, flow, flow, bars, compare.

## TL;DR
- Silent Illustrator tutorial (music only, no captions). Everything below is read from the frames, the on-screen text and the description's chapter list.
- The creator first draws three swooshes with the Pen Tool, then puts "WRONG METHOD / NOT PERFECT..." on screen. The chapter title gives the reason: Pen Tool swooshes look uneven and asymmetrical.
- The method shown instead: circle (Ellipse Tool) -> Shear Tool drag into a tilted ellipse -> Copy + Edit > Paste in Front -> drag the copy a little (first example dX 35.64 px, dY -19.44 px) -> Pathfinder > Minus Front. What is left is a crescent "swoosh". Both edges come from ellipse outlines, so they are smooth, and both ends taper by themselves.
- From ~3:41: Rotate dialog + Copy around a set centre (120 deg, 60 deg; 180 deg is also seen) builds four logos. They are coloured from Swatches and assembled into "Community Logo".

## Key Concepts
1. **Problem (0:00-1:32).** Pen Tool swooshes need every anchor and handle placed by hand. The creator marks them with red X icons (~0:54, ~1:16) and the "WRONG METHOD / NOT PERFECT..." card (~1:28). The clip never points at a specific defect.
2. **Base shape (1:32-1:53).** Ellipse Tool circle -> Shear Tool (tooltip seen ~1:44). The live readout while dragging shows values such as S: -55.2 deg, -27.4 deg, -29.02 deg. These are live values; the final value is not shown.
3. **Duplicate in place (1:53-2:08).** Copy (Ctrl+C), then Edit > Paste in Front (Ctrl+F). The Edit menu's first line reads "Undo Shear", which confirms the order of steps. The copy is then dragged slightly up-right (dX 35.64 px, dY -19.44 px).
4. **Boolean cut (2:08-2:24).** Both ellipses are selected, then the Properties panel's Pathfinder > Minus Front is clicked (tooltip: "Click to Minus Front. Alt-click to create a Compound Shape."). The front shape removes the overlap and is itself removed. The remaining sliver of the back ellipse is the swoosh: its outer edge comes from the back ellipse and its inner edge from the copy.
5. **Variations (2:24-3:41).** The same recipe with a different ellipse tilt or fatness and a different offset direction gives thinner and horizontal swooshes (third one: copy dragged down-left, live readout dX -27 px, dY 29.16 px at ~3:08). Everything is recoloured black (~3:20). A finished swoosh is then reshaped into a new arching shape (~3:32; chapter title says Shear Tool).
6. **Logos 1-2 (3:41-5:08).** Set the rotation centre (~3:58), then Rotate 120 deg + Copy, repeated. Result: three swoosh + dot "people" in a ring. With 60 deg the result is a six-swoosh swirl. (Author note: n equal pieces need 360/n degrees.)
7. **Logos 3-4 (5:08-6:25).** Logo 3: C-shaped swooshes with big dots, four sets in a ring; a Rotate dialog shows 180 deg once at ~5:29, and not every rotation step is visible, so how four sets were made is not shown (180 deg alone would give two). Logo 4: long pointed swooshes around one central dot, only partly visible in the frames.
8. **Colour (6:25-7:20).** Flat Swatches colours (red, green, blue, yellow); each swoosh + its dot gets one colour. The chapter title says "Coloring & Shading", but no gradient shading is visible in the frames checked.
9. **Custom shape + final (7:20-10:00).** Black circle -> flattened ellipse -> rotated -> a copy placed inside it -> after the cut there are two thin tapered arcs, grouped, then ungrouped (~7:40). The exact boolean button is not visible; it looks like the same Minus Front (author inference). A red circle is placed in the middle; the arc tips meet its edge (front/back order not clear from the frames), giving a planet-like ring shape (~8:22). The final piece is the four-colour logo (four swoosh + dot sets) above the typed text "Community Logo" (~9:38). The giveaway and the end screen are promotional and were dropped.

## Implementation
Playbook (Illustrator), as shown:
1. Ellipse Tool: draw a circle.
2. Shear Tool: drag on it until it becomes a tilted ellipse.
3. Ctrl+C, then Edit > Paste in Front (Ctrl+F): the copy lands exactly on top.
4. Drag the copy a small distance (example: dX 35.64 px, dY -19.44 px). The offset sets the swoosh thickness and which side survives (author interpretation from the results).
5. Select both shapes -> Properties > Pathfinder > Minus Front -> swoosh.
6. Optional: Shear the finished swoosh again for a different arc.
7. Logo: group a swoosh with a dot, set the rotation origin at the logo centre, Object > Transform > Rotate (dialog), enter the angle (120 / 60 / ...), press Copy, then repeat until the ring is full.

Author note for a vector pen tool (e.g. ZKRoto): a tapered stroke whose two edges are both smooth can be built as the region between two offset copies of one smooth closed curve (boolean A minus shifted A), instead of placing edge points by hand. A pen tool that targets hair strands would benefit from a Minus-Front style boolean and a rotate-copy-around-centre command.

## Quick Reference
| item | value | time |
|---|---|---|
| on-screen verdict on Pen Tool | "WRONG METHOD / NOT PERFECT..." | ~1:28 |
| shear tool | Shear Tool (toolbar tooltip) | ~1:44 |
| live shear readout | e.g. S: -29.02 deg (live, not final) | ~1:47 |
| paste | Edit > Paste in Front, Ctrl+F (after Ctrl+C) | ~1:56 |
| copy offset, example 1 (live drag readout) | dX 35.64 px, dY -19.44 px | ~2:06 |
| copy offset, variation 3 (live drag readout) | dX -27 px, dY 29.16 px | ~3:08 |
| boolean | Properties > Pathfinder > Minus Front | ~2:13 |
| rotate logo 1 | 120 deg + Copy | ~4:08 |
| rotate logo 2 | 60 deg + Copy | ~4:50 |
| rotate seen in logo 3 | 180 deg | ~5:29 |
| final | "Community Logo", four people, four colours | ~9:38 |

## Comparisons
| | Pen Tool (start of clip) | ellipse + Minus Front |
|---|---|---|
| how the curve is made | anchors and handles placed by hand | both edges taken from ellipse outlines |
| creator's verdict on screen | "WRONG METHOD / NOT PERFECT..." | check mark |
| changing the shape | edit points one by one (author) | change tilt, size or offset, cut again |

## Tags & Triggers
Illustrator, swoosh, Shear Tool, Pathfinder, Minus Front, Paste in Front, Rotate copy, logo, vector curve, tapered stroke.
- How do I make a smooth tapered swoosh in Illustrator without the Pen Tool?
- What does Minus Front do with two offset ellipses?
- How do I build a radial logo with Rotate + Copy?

## References
- YouTube, CreativeAlys, "How to Make Perfect Curved Swooshes in Illustrator (Without Pen Tool!)", 2022-05-31, https://www.youtube.com/watch?v=mUxPKlBLmWo
