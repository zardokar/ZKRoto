"""Unit tests for zk_export.py (the file rules of POST /zkroto/export and the two GET reads).

Run: python -m unittest discover -s atdd -p "test_*.py" (from the repo root); atdd/zk_route.test.js runs it.
"""
import base64
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import zk_export as zx  # noqa: E402

PNG = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 16).decode()
FOLDER = "walk01_FRA-007"
POV = "pov_y035_h155_d120_f60"


def png(sub, name):
    return {"sub": sub, "name": name, "png": PNG}


def js(sub, name, obj=None):
    return {"sub": sub, "name": name, "json": obj if obj is not None else {"a": 1}}


class Names(unittest.TestCase):
    def test_folder_names(self):
        for ok in ("walk01_FRA-007", "walk01", "zkroto-test-fra007_FRA-007"):
            self.assertTrue(zx.check_folder(ok), ok)
        for bad in ("", "..", "a/b", "a\\b", "a_b_c", "_a", "a_", "a b", "a.b", "ตัว"):
            self.assertFalse(zx.check_folder(bad), bad)

    def test_no_newline_unicode_digits_or_reserved_names(self):
        self.assertFalse(zx.check_folder("walk01\n"))
        self.assertFalse(zx.check_camera("src\n"))
        self.assertFalse(zx.check_file(FOLDER, "zkroto", FOLDER + "_f\u0663\u0664.json"))
        self.assertFalse(zx.check_file(FOLDER, "zkroto", FOLDER + "_shot.json\n"))
        for bad in ("CON", "nul", "Aux_FRA", "com1", "LPT9_x", "capture", "Capture_FRA-007"):
            self.assertFalse(zx.check_folder(bad), bad)
        self.assertTrue(zx.check_folder("console_FRA"))

    def test_camera_names(self):
        for ok in ("src", POV, POV + "_rm10", POV + "_r5_L", POV + "_c1024x1024", "pov_y270_h020_d500_f100"):
            self.assertTrue(zx.check_camera(ok), ok)
        for bad in ("pov", "pov_y35_h155_d120_f60", POV + "_X", "../src", "src.png"):
            self.assertFalse(zx.check_camera(bad), bad)

    def test_files_by_sub_folder(self):
        f = FOLDER
        good = [("openpose/src", f + "_f000123_src.png"), ("openpose/src", f + "_f000123_src.json"),
                ("openpose/pov", f"{f}_f000123_{POV}.png"), ("mediapipe/src", f + "_f000123_src.json"),
                ("mediapipe/pov", f"{f}_f000123_{POV}.json"), ("mediapipe", f"{f}_sheet_{POV}.png"),
                ("mediapipe", f + "_sheet_src.png"), ("zkroto", f + "_f000123.json"), ("zkroto", f + "_shot.json"), ("zkroto", f + "_edits.json"),
                ("openpose/face/src", f + "_f000123_src.png"), ("openpose/face/pov", f"{f}_f000123_{POV}.json"),
                ("mediapipe/face/src", f + "_f000123_src.json"), ("mediapipe/face/pov", f"{f}_f000123_{POV}.json"),
                ("openpose/full/src", f + "_f000123_src.png"), ("openpose/full/pov", f"{f}_f000123_{POV}.png")]
        for sub, name in good:
            self.assertTrue(zx.check_file(f, sub, name), (sub, name))
        bad = [("openpose/src", f"{f}_f000123_{POV}.png"), ("openpose/pov", f + "_f000123_src.png"),
               ("mediapipe/src", f + "_f000123_src.png"), ("mediapipe", f + "_f000123_src.json"),
               ("zkroto", "other_shot.json"), ("openpose", f + "_f000123_src.png"), ("../x", f + "_shot.json"),
               ("zkroto", f + "_shot.json/.."), ("zkroto", "..\\" + f + "_shot.json"), ("input", f + "_shot.json"),
               ("mediapipe/face/src", f + "_f000123_src.png"), ("openpose/face", f + "_f000123_src.png"),
               ("mediapipe/face/pov", f + "_f000123_src.json"), ("openpose/full/src", f + "_f000123_src.json"),
               ("openpose/full/pov", f"{f}_f000123_{POV}.json"), ("openpose/full/pov", f + "_f000123_src.png"),
               ("openpose/full", f + "_f000123_src.png"),
               ("zkroto", f + "_edits.png"), ("zkroto", "x_edits.json"), ("mediapipe/pov", f + "_edits.json")]
        for sub, name in bad:
            self.assertFalse(zx.check_file(f, sub, name), (sub, name))


class Writes(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.root)

    def test_writes_only_under_the_shot_folder_and_creates_sub_folders(self):
        files = [png("openpose/pov", f"{FOLDER}_f000123_{POV}.png"), js("zkroto", FOLDER + "_shot.json", {"x": 2})]
        out = zx.write_files(self.root, FOLDER, files)
        self.assertEqual(out, [f"{FOLDER}/openpose/pov/{FOLDER}_f000123_{POV}.png", f"{FOLDER}/zkroto/{FOLDER}_shot.json"])
        with open(os.path.join(self.root, FOLDER, "zkroto", FOLDER + "_shot.json"), encoding="utf-8") as fh:
            self.assertEqual(json.load(fh), {"x": 2})
        with open(os.path.join(self.root, FOLDER, "openpose", "pov", f"{FOLDER}_f000123_{POV}.png"), "rb") as fh:
            self.assertTrue(fh.read().startswith(b"\x89PNG"))

    def test_refuses_everything_when_one_file_is_wrong(self):
        files = [js("zkroto", FOLDER + "_shot.json"), js("zkroto", "../../evil.json")]
        with self.assertRaises(ValueError):
            zx.write_files(self.root, FOLDER, files)
        self.assertEqual(os.listdir(self.root), [])

    def test_refuses_bad_folder_wrong_payload_kind_and_non_png_bytes(self):
        with self.assertRaises(ValueError):
            zx.write_files(self.root, "../x", [js("zkroto", "x_shot.json")])
        with self.assertRaises(ValueError):
            zx.write_files(self.root, FOLDER, [js("openpose/src", FOLDER + "_f000001_src.png")])
        with self.assertRaises(ValueError):
            zx.write_files(self.root, FOLDER, [{"sub": "openpose/src", "name": FOLDER + "_f000001_src.png",
                                               "png": base64.b64encode(b"GIF89a").decode()}])
        with self.assertRaises(ValueError):
            zx.write_files(self.root, FOLDER, [])
        self.assertEqual(os.listdir(self.root), [])

    def test_more_than_20_files_refused(self):
        files = [js("zkroto", f"{FOLDER}_f{i:06d}.json") for i in range(21)]
        with self.assertRaises(ValueError):
            zx.write_files(self.root, FOLDER, files)

    def test_symlinked_shot_folder_is_refused(self):
        outside = tempfile.mkdtemp()
        try:
            os.symlink(outside, os.path.join(self.root, FOLDER))
            with self.assertRaises(ValueError):
                zx.write_files(self.root, FOLDER, [js("zkroto", FOLDER + "_shot.json")])
            self.assertEqual(os.listdir(outside), [])
        finally:
            shutil.rmtree(outside)

    def test_os_error_becomes_value_error_and_leaves_no_temp_file(self):
        os.makedirs(os.path.join(self.root, FOLDER, "zkroto", FOLDER + "_shot.json"))
        with self.assertRaises(ValueError):
            zx.write_files(self.root, FOLDER, [js("zkroto", FOLDER + "_shot.json")])
        self.assertEqual(os.listdir(os.path.join(self.root, FOLDER, "zkroto")), [FOLDER + "_shot.json"])

    def test_same_name_overwrites(self):
        name = FOLDER + "_f000123.json"
        zx.write_files(self.root, FOLDER, [js("zkroto", name, {"v": 1})])
        zx.write_files(self.root, FOLDER, [js("zkroto", name, {"v": 2})])
        self.assertEqual(zx.read_json(self.root, FOLDER, "zkroto", name), {"v": 2})


class Reads(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.root)

    def test_read_json_missing_is_none_and_bad_name_refused(self):
        self.assertIsNone(zx.read_json(self.root, FOLDER, "zkroto", FOLDER + "_shot.json"))
        with self.assertRaises(ValueError):
            zx.read_json(self.root, FOLDER, "zkroto", "../secret.json")

    def test_sheet_data_lists_one_camera_in_frame_order(self):
        files = [js("mediapipe/pov", f"{FOLDER}_f000125_{POV}.json", {"frame": 125}),
                 js("mediapipe/pov", f"{FOLDER}_f000120_{POV}.json", {"frame": 120}),
                 js("mediapipe/pov", f"{FOLDER}_f000121_{POV}_L.json", {"frame": 121}),
                 js("mediapipe/src", f"{FOLDER}_f000122_src.json", {"frame": 122})]
        zx.write_files(self.root, FOLDER, files)
        self.assertEqual([f["frame"] for f in zx.sheet_data(self.root, FOLDER, POV)], [120, 125])
        self.assertEqual([f["frame"] for f in zx.sheet_data(self.root, FOLDER, "src")], [122])
        self.assertEqual(zx.sheet_data(self.root, "other", "src"), [])
        with self.assertRaises(ValueError):
            zx.sheet_data(self.root, FOLDER, "../src")


if __name__ == "__main__":
    unittest.main()
