"""Tests for tools/zk_guides.py: ZKRoto per-frame JSON -> one SVG guide file per frame (step 7, vector paths)."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOL = os.path.join(ROOT, "tools", "zk_guides.py")
CAM = "pov_y000_h155_d120_f60"
SVG = "{http://www.w3.org/2000/svg}"
INK = "{http://www.inkscape.org/namespaces/inkscape}"


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f)


def make_shot(root, frames, face_on=(), cam=CAM, side="pov", low=(20,)):
    shot = os.path.join(root, "walk01_FRA-007")
    for n in frames:
        f = f"walk01_FRA-007_f{n:06d}_{cam}"
        op = []
        for j in range(18):
            op += [100 + 10 * j + n, 200 + 20 * j, 1 if j != 4 else 0]
        write(os.path.join(shot, "openpose", side, f + ".json"),
              {"canvas_width": 832, "canvas_height": 1216, "people": [{"pose_keypoints_2d": op}]})
        pts = [[300 + j + n, 400 + 2 * j, 0.1 if j in low else 0.9] for j in range(33)]
        write(os.path.join(shot, "mediapipe", side, f + ".json"),
              {"frame": n, "camera": cam, "width": 832, "height": 1216, "points": pts, "world": [[0, 0, 0]] * 33})
        if n in face_on:
            fk = []
            for j in range(70):
                fk += [500 + j, 150 + j, 1]
            write(os.path.join(shot, "openpose", "face", side, f + ".json"),
                  {"canvas_width": 832, "canvas_height": 1216, "people": [{"face_keypoints_2d": fk}]})
        write(os.path.join(shot, "zkroto", f"walk01_FRA-007_f{n:06d}.json"),
              {"frame": n, "cameras": {cam: {"fit": {"s": 1.05, "tx": -23.1, "ty": -362.0}, "range": [0, 2]}}})
    return shot


def run(*args):
    return subprocess.run([sys.executable, "-I", TOOL, *args], capture_output=True, text=True)


def layers(svg_path):
    tree = ET.parse(svg_path).getroot()
    return tree, {g.get(INK + "label"): g for g in tree.iter(SVG + "g") if g.get(INK + "groupmode") == "layer"}


class Guides(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_one_svg_per_frame_same_size_and_layers(self):
        shot = make_shot(self.tmp, [0, 1, 2], face_on=[1])
        r = run(shot)
        self.assertEqual(r.returncode, 0, r.stderr)
        out = os.path.join(shot, "guides", CAM)
        names = sorted(os.listdir(out))
        self.assertEqual(names, [f"walk01_FRA-007_f{n:06d}_{CAM}.svg" for n in range(3)])
        root, ls = layers(os.path.join(out, names[1]))
        self.assertEqual((root.get("width"), root.get("height"), root.get("viewBox")), ("832", "1216", "0 0 832 1216"))
        for name in ("mediapipe 33 bones", "openpose 18", "body axes", "joints", "face 70", "low visibility", "info"):
            self.assertIn(name, ls, name)
        self.assertEqual(ls["openpose 18"].get("style"), "display:none", "OpenPose is hidden by default")
        self.assertIsNone(ls["body axes"].get("style"))
        _, ls0 = layers(os.path.join(out, names[0]))
        self.assertNotIn("face 70", ls0, "no face file for frame 0: no face layer")
        with open(os.path.join(out, names[1]), encoding="utf-8") as f:
            self.assertIn("f000001", f.read())

    def test_joints_are_exact_pixels_with_names_and_hidden_joints_left_out(self):
        shot = make_shot(self.tmp, [2])
        run(shot)
        _, ls = layers(os.path.join(shot, "guides", CAM, f"walk01_FRA-007_f000002_{CAM}.svg"))
        circles = {c.get("id"): c for c in ls["joints"].iter(SVG + "circle")}
        self.assertFalse([i for i in circles if i.startswith("op_")], "OpenPose joints live in the hidden OpenPose layer")
        ops = {c.get("id"): c for c in ls["openpose 18"].iter(SVG + "circle")}
        wrist = ops["op_02_right_shoulder"]
        self.assertEqual((float(wrist.get("cx")), float(wrist.get("cy"))), (100 + 20 + 2, 200 + 40))
        self.assertNotIn("op_04_right_wrist", ops, "c = 0: not drawn")
        mp = circles["mp_15_left_wrist"]
        self.assertEqual((float(mp.get("cx")), float(mp.get("cy"))), (300 + 15 + 2, 400 + 30))
        self.assertNotIn("mp_20_right_index", circles, "under the visibility threshold: not a joint")
        low = [c.get("id") for c in ls["low visibility"].iter(SVG + "circle")]
        self.assertEqual(low, ["mp_20_right_index"])
        self.assertEqual(ls["low visibility"].get("style"), "display:none")
        for name, g in ls.items():
            self.assertEqual(g.get("{http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd}insensitive"), "true", name)

    def test_body_axes_spine_shoulders_hips_at_exact_midpoints(self):
        shot = make_shot(self.tmp, [2])
        run(shot)
        _, ls = layers(os.path.join(shot, "guides", CAM, f"walk01_FRA-007_f000002_{CAM}.svg"))
        lines = {l.get("id"): [float(l.get(a)) for a in ("x1", "y1", "x2", "y2")] for l in ls["body axes"].iter(SVG + "line")}
        p = lambda j: (300 + j + 2, 400 + 2 * j)
        mid = lambda a, b: ((p(a)[0] + p(b)[0]) / 2, (p(a)[1] + p(b)[1]) / 2)
        self.assertEqual(lines["axis_shoulders"], [*p(11), *p(12)])
        self.assertEqual(lines["axis_hips"], [*p(23), *p(24)])
        self.assertEqual(lines["axis_spine"], [*mid(11, 12), *mid(23, 24)])
        dots = {c.get("id"): (float(c.get("cx")), float(c.get("cy"))) for c in ls["body axes"].iter(SVG + "circle")}
        self.assertEqual(dots, {"axis_shoulder_mid": mid(11, 12), "axis_hip_mid": mid(23, 24)})
        shutil.rmtree(shot)
        shot = make_shot(self.tmp, [2], low=(24,))
        run(shot)
        _, ls = layers(os.path.join(shot, "guides", CAM, f"walk01_FRA-007_f000002_{CAM}.svg"))
        ids = sorted(e.get("id") for e in ls["body axes"] if e.get("id"))
        self.assertEqual(ids, ["axis_shoulder_mid", "axis_shoulders"], "a hip under min-vis: no hip line, no spine")

    def test_info_layer_carries_frame_camera_and_range_framing(self):
        shot = make_shot(self.tmp, [0])
        run(shot)
        _, ls = layers(os.path.join(shot, "guides", CAM, f"walk01_FRA-007_f000000_{CAM}.svg"))
        text = " ".join(t.text or "" for t in ls["info"].iter(SVG + "text"))
        for part in ("f000000", CAM, "range 0-2", "fit s 1.05"):
            self.assertIn(part, text)

    def test_generated_pictures_matched_in_order_under_the_guides(self):
        shot = make_shot(self.tmp, [0, 1])
        gen = os.path.join(self.tmp, "gen")
        os.makedirs(gen)
        for i in (1, 2):
            open(os.path.join(gen, f"zkroto_pose_v001a1_hands_{i:05d}_.png"), "wb").close()
        r = run(shot, "--images", gen)
        self.assertEqual(r.returncode, 0, r.stderr)
        _, ls = layers(os.path.join(shot, "guides", CAM, f"walk01_FRA-007_f000001_{CAM}.svg"))
        img = list(ls["generated"].iter(SVG + "image"))[0]
        self.assertTrue(img.get("{http://www.w3.org/1999/xlink}href").endswith("zkroto_pose_v001a1_hands_00002_.png"))
        self.assertEqual((img.get("width"), img.get("height")), ("832", "1216"))
        bad = os.path.join(self.tmp, "bad")
        os.makedirs(bad)
        open(os.path.join(bad, "only_one.png"), "wb").close()
        r2 = run(shot, "--images", bad)
        self.assertNotEqual(r2.returncode, 0)
        self.assertIn("2 frames", r2.stderr)
        r3 = run(shot, "--images", os.path.join(self.tmp, "nope"))
        self.assertNotEqual(r3.returncode, 0)
        self.assertIn("pictures folder not found", r3.stderr)
        self.assertNotIn("Traceback", r3.stderr)

    def test_pictures_with_frame_numbers_match_by_frame_and_gen_folder_is_used_by_default(self):
        shot = make_shot(self.tmp, [0, 1, 2])
        gen = os.path.join(shot, "gen", CAM)
        os.makedirs(gen)
        for n in (2, 1):
            open(os.path.join(gen, f"walk01_FRA-007_f{n:06d}_{CAM}_gen.png"), "wb").close()
        r = run(shot)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("2 picture(s)", r.stdout)
        self.assertIn("f000000", r.stdout, "the frame with no picture is named")
        _, ls0 = layers(os.path.join(shot, "guides", CAM, f"walk01_FRA-007_f000000_{CAM}.svg"))
        self.assertNotIn("generated", ls0)
        _, ls1 = layers(os.path.join(shot, "guides", CAM, f"walk01_FRA-007_f000001_{CAM}.svg"))
        img = list(ls1["generated"].iter(SVG + "image"))[0]
        self.assertTrue(img.get("{http://www.w3.org/1999/xlink}href").endswith(f"_f000001_{CAM}_gen.png"))

    def test_camera_choice_and_errors(self):
        shot = make_shot(self.tmp, [0])
        make_shot(self.tmp, [0], cam="pov_y090_h155_d120_f60")
        r = run(shot)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("--camera", r.stderr)
        self.assertEqual(run(shot, "--camera", "pov_y090_h155_d120_f60").returncode, 0)
        make_shot(self.tmp, [0], cam="src", side="src")
        self.assertEqual(run(shot, "--camera", "src").returncode, 0)
        self.assertTrue(os.path.isdir(os.path.join(shot, "guides", "src")))
        self.assertNotEqual(run(os.path.join(self.tmp, "nope")).returncode, 0)


if __name__ == "__main__":
    unittest.main()
