"""Tests for tools/zk_genname.py: copy ComfyUI output pictures to frame-number names under <shot>/gen/<camera>."""
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_zk_guides import CAM, make_shot  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOL = os.path.join(ROOT, "tools", "zk_genname.py")


def run(*args):
    return subprocess.run([sys.executable, "-I", TOOL, *args], capture_output=True, text=True)


def picture(folder, name, body):
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, name), "wb") as f:
        f.write(body)


def digest(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


class GenName(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.shot = make_shot(self.tmp, [4, 5, 6])
        self.out = os.path.join(self.tmp, "output")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def gen(self, n):
        return os.path.join(self.shot, "gen", CAM, f"walk01_FRA-007_f{n:06d}_{CAM}_gen.png")

    def test_copies_in_name_order_to_frame_names_and_keeps_the_sources(self):
        for i in (1, 2, 3):
            picture(self.out, f"zkroto_pose_v001a1_hands_{i:05d}_.png", b"pic%d" % i)
        picture(self.out, "zkroto_pose_v001a1_raw_00001_.png", b"raw")
        r = run(self.shot, self.out, "--prefix", "zkroto_pose_v001a1_hands")
        self.assertEqual(r.returncode, 0, r.stderr)
        for n, i in ((4, 1), (5, 2), (6, 3)):
            with open(self.gen(n), "rb") as f:
                self.assertEqual(f.read(), b"pic%d" % i)
        self.assertEqual(len(os.listdir(self.out)), 4, "copy, never move")
        with open(os.path.join(self.shot, "gen", CAM, "gen_map.txt"), encoding="utf-8") as f:
            text = f.read()
        self.assertIn("zkroto_pose_v001a1_hands_00001_.png -> walk01_FRA-007_f000004_", text)
        self.assertIn("3 picture(s)", r.stdout)

    def test_count_must_match_unless_last_takes_the_newest(self):
        for i in (1, 2, 3, 4, 5):
            picture(self.out, f"zkroto_pose_v001a1_hands_{i:05d}_.png", b"pic%d" % i)
        r = run(self.shot, self.out, "--prefix", "zkroto_pose_v001a1_hands")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("5 picture(s)", r.stderr)
        self.assertIn("--last", r.stderr)
        self.assertFalse(os.path.exists(self.gen(4)), "nothing copied on an error")
        r = run(self.shot, self.out, "--prefix", "zkroto_pose_v001a1_hands", "--last")
        self.assertEqual(r.returncode, 0, r.stderr)
        with open(self.gen(4), "rb") as f:
            self.assertEqual(f.read(), b"pic3", "the newest 3 by counter")

    def test_never_overwrites_a_different_picture_without_force(self):
        for i in (1, 2, 3):
            picture(self.out, f"a_{i:05d}_.png", b"new%d" % i)
        picture(os.path.dirname(self.gen(5)), os.path.basename(self.gen(5)), b"old")
        r = run(self.shot, self.out, "--prefix", "a")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("--force", r.stderr)
        self.assertFalse(os.path.exists(self.gen(4)), "nothing copied on an error")
        with open(self.gen(5), "rb") as f:
            self.assertEqual(f.read(), b"old")
        self.assertEqual(run(self.shot, self.out, "--prefix", "a", "--force").returncode, 0)
        self.assertEqual(digest(self.gen(5)), digest(os.path.join(self.out, "a_00002_.png")))
        self.assertEqual(run(self.shot, self.out, "--prefix", "a").returncode, 0, "same bytes again: fine")


if __name__ == "__main__":
    unittest.main()
