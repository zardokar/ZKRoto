# ZKRoto UI policy (the standard way of working)

Koh 2026-11-24 16:21: "ok จดวิธีการทำงานแบบนี้ไว้เป็น standard". This file is the project policy that the z-ui skill reads first. Its rules win over the z-ui defaults.
The example it was written from is the request / compare design of 2026-11-24, `D:\repository\ZComfy\.dropzone\lab\20261124_zkreq\` (notes.md, wf_zkreq_1-3).

## 1. The routine for every new screen, button, panel or flow (in order; no step is skipped)

| # | step | what comes out |
|---|---|---|
| R1 | **Ask only what decides the design.** One AskUserQuestion with 2-4 choices per question (trigger, what goes in, where the result goes). Ask it before any drawing. | Koh's answers, quoted in the lab notes |
| R2 | **Research first** (ZComfy CLAUDE.md 5b). Read the project recipe and dead ends (`references/pipeline.md`), search how others do the same job, and name the sources with links before anything is drawn. | "Sources the plan follows" list in `notes.md` |
| R3 | **Look at the real page first.** Take a screenshot of the live page and find the free space there. Never place things from memory. | the place, with the evidence |
| R4 | **SVG wireframe.** Zones as labelled dashed boxes, the main input marked, buttons drawn as icons, the red "ตัวอย่างแต่งขึ้น" banner, notes with arrows and references. Apply the design principles of section 2b (alignment, contrast, proximity) and run their checks D5. Render it to PNG, look at it (and at a zoom of every place where rows or columns meet), then send it. | `wf_<topic>_<n>.svg` + `.png` in `.dropzone/lab/<YYYYMMDD>_<topic>/` |
| R5 | **Koh reviews; each correction is a new round.** Quote his words with the clock time in `notes.md` and draw `wf_..._<n+1>` (never edit an older round). Repeat until Koh says OK. | rounds 1..n, his words per round |
| R6 | **Only after the OK:** tests first (red), then code, then the look check and the feel pass (z-ui steps 7-8). | green tests, screenshots |
| R7 | **Deliver.** Ship all three copies, stage them back and cmp them, check live without reloading Koh's page while he has a drawing in it, and get a review by a separate Sonnet agent before saying "done". | evidence lines in the lab notes |

## 2. Layout rules

| id | rule | Koh |
|---|---|---|
| L1 | The left bar holds the tools that act on the canvas only. Mask mode: V A P Z I and the Fill / Stroke box. Roto mode: Move point (E), Reset frame (while editing) and Zoom (Z). | voice 2026-11-24 16:0x; Roto tools: 2026-11-26 17:54 "ok mewfhg]p" (= "ok ทำได้เลย") on wireframe round 1, `D:\repository\ZComfy\.dropzone\lab\20261126_zkroto_modes\` |
| L2 | Commands that act on the drawing or its result (Export SVG, Send to Claude, Compare) are a separate group at the top, in the one header row of Mask mode, flush against the right edge of the page (not right after the other controls), "out" (import, export, send) and "look" (compare) 16 apart. | voice 16:0x; 16:21 "เครื่องมือชุดนี้ชิดขวาเลย"; one header row, 16 apart without the old divider: wireframe wf_modes round 1, 2026-11-26 17:54 "ok mewfhg]p" (= "ok ทำได้เลย") |
| L3 | Buttons are icons only, with no words beside them. The name goes in a themed tooltip. This also covers segmented switches (for example side by side vs wipe). | 16:20 "ไม่ต้องใส่ text" |
| L4 | A before / after view has two modes. Side by side shows two pictures. Wipe shows one picture, before over after, with a handle dragged left and right. In both modes, zoom and pan move both pictures together. | voice 16:0x |
| L5 | A panel that opens over the stage closes with Esc or the X button and never moves the stage under it. | z-ui rule (judged item never moves) |

## 2b. Design principles: alignment, contrast, proximity (Koh, voice 2026-11-25 ~21:13 "จดบันทึกไฟล์ MD สำหรับการวาง alignment แบบนี้เสมอ นอกจากการทำ wireframe ก่อน มันจะต้องคิดถึงการทำ alignment contrast และ proximity ตามหลัก design principle")
Why: in wireframe round 2 of the zkapi design (2026-11-25, `D:\repository\ZComfy\.dropzone\lab\20261125_zkapi\`) the new top row was placed without the columns of the row under it: no edge of the dropdown or the refresh button matched a button below, and one highlight frame was 36 px wide while the others were 38 px. Koh (voice ~21:1x): "ตรงกันจริงไหม ... รู้สึกว่ามันไม่ค่อยตรงนะ". Round 3 put both rows on one grid.
Sources: Robin Williams, The Non-Designer's Design Book (4 principles: proximity, alignment, repetition, contrast; https://www.pearson.com/store/en-gb/p/non-designer-s-design-book-the/P200000000691); NN/g, Proximity principle (https://www.nngroup.com/articles/gestalt-proximity/); MIT 6.813 layout lecture, fewer alignment positions = simpler design (https://web.mit.edu/6.813/www/sp17/classes/14-layout/).

| id | principle | rule |
|---|---|---|
| D1 | Alignment | Every object shares at least one of its six lines (left, centre, right, top, middle, bottom) with another object, checked on numbers from wherever the design lives (SVG, DOM, a design file: not tied to the DOM); a grid may be laid on afterwards (Koh voice 2026-11-25 ~22:3x "อย่างน้อยอ่ะไอ้ object หนึ่งตัวมันควร alignment กับอะไรอีกสักตัวหนึ่ง", "อย่าไปยึดกับ DOM"). Every element sits on a line shared with something else. Rows that stack use the same columns: each edge of a new control lands on an edge of a control above or below it, or the difference is a stated choice in the notes. Fewer alignment lines is better. Icons sit centred in their buttons. |
| D2 | Contrast | What differs must differ clearly (size, weight, colour, fill), never "a little". The main input is the strongest thing at rest; one emphasised thing besides it (z-ui); the yellow "new" frames of a wireframe are review marks, not part of the design, and do not count. Marks over a picture follow K1. Text and icons keep readable contrast on the theme background. |
| D3 | Proximity | Things that belong together are close; separate groups have a clearly larger gap (a divider or at least twice the inner gap). One gap value inside a group, from the spacing scale (z-ui: 4 / 8 / 12 / 16 / 24); a gap taken from an existing bar is measured on the live page (R3), and if it is off the scale that is written in the notes as an open point. A label is nearer to its own control than to the next one. |
| D4 | Repetition | The same kind of thing looks the same everywhere: one button size per bar, one corner radius, one highlight frame rule (same offset from the button), one icon stroke. |
| D5 | Checks, every wireframe round and the look check of R6 | (a) Draw guide lines on every edge of the controls being placed, with the x / y numbers, in the wireframe. (b) A script lists the edges and asserts D1 (each new edge equals an existing one) and the D3 gaps. (c) Zoom the render at 3-4x on every place where rows, columns or groups meet and look. (d) Write the numbers and what was seen in the lab `notes.md`. (e) The script compares each new edge with the edges of the controls ABOVE and BELOW it (the trigger button, the rows of the bar), not only with the other edges inside the new element. (f) Every new element is checked, not only the bar: each panel, popover, error box, word box and tooltip, in each of its states, gets its own D1-D4 pass and numbers. A wireframe or build with a failed or missing check is not sent. |

### 2c. Why the zkapi key panel broke although the rules existed (Koh 2026-11-25 22:02 "นี่เรียกว่าถูกหลัก Design UI ที่ดีแล้วเหรอ หรือ ความรู้ที่เคยสอนเอามาได้แค่นี้", 22:03 "นี่อะไร", 22:10 "นี่คือดีแล้วใช่ไหม", 22:14 "จดจุดที่ผิด ทำไม พัง ทั้งที่ควรจะดี ได้ดูเรื่อง rule ui_policy ไหม")
- The wireframe drew the panel only as a box; its inside (X, input, eye, save, delete, sizes) was decided while coding, so it never had a D1-D4 pass. Rule: every panel is drawn with its inside and numbers before code (R4).
- The build's look check ran D5 on the two header rows only; the key panel, error box and word box were checked for "it works" (401 box, no-key panel), not for alignment, contrast and proximity. Rule: D5 (f).
- The row-1 tooltip reused the row-2 CSS (opens downward), so it slid under row 2 and only "AP" showed between two buttons. Hover and focus of every new control are part of the feel pass (z-ui step 8); a tooltip is checked where it lands.
- Wireframe round 4 checked edges inside the panel only (911 / 1227) and missed that save and X matched nothing above (key 1203-1239). Rule: D5 (e).

## 3. Look and feel rules learned on the pen tool (2026-11-24)

| id | rule | Koh |
|---|---|---|
| K1 | Thin marks drawn over the picture (handle arms, guides) are a dark line under a light line, so they show on any fill. | 15:33 "แขน กลืนกับ สี fill ไม่ contrast" |
| K2 | Cursors keep the drawings of the canvas module at 16 px with thin lines. The page draws them with inverted ink, so they show on every colour. | 13:47, 13:57 |
| K3 | Vector marks stay sharp at any zoom. Draw at screen resolution, never scale a bitmap. | 13:57 |
| K4 | What you see is what you hit. A fill that is shown must also be clickable, including the fill of an open path. | 15:26 |
| K5 | Curves are drawn as true curves, not as straight pieces. | 14:31 |
| K6 | Every visible part of a control is complete. A curve point shows both arms. | 14:30 |

## 4. Where things go
- Wireframes, notes and research for a new feature go in `D:\repository\ZComfy\.dropzone\lab\<YYYYMMDD>_<topic>\`. They move to a root `lab\` only on Koh's word.
- A new rule from Koh goes into this file, with his words and the clock time, in the same session.
- The same file is kept in three places, byte-equal: `D:\repository\ZKRoto\docs\ui_policy.md`, `E:\ComfyUI\ComfyUI\custom_nodes\ZKRoto\docs\ui_policy.md`, `D:\repository\ZComfy\.dropzone\src\scripts\zkroto\docs\ui_policy.md`.
