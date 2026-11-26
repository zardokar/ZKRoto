"""Unit tests for zk_request.py: the request folder the page writes for Claude and the answers Claude writes back.

Koh 2026-11-24 15:37 / 16:0x: drawn shapes = mask, the open picture = base, Compare shows the answers.
Design: D:/repository/ZComfy/.dropzone/lab/20261124_zkreq/ (wf_zkreq_3, notes.md).
Run: python -m unittest discover -s atdd -p "test_*.py" (from the repo root).
"""
import base64
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import zk_request as zr  # noqa: E402

PNG = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\x00" * 16).decode()
SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><path d="M0 0L4 0L4 4Z"/></svg>'
REQ = {"picture": "LK19_ref_eyes.png", "width": 358, "height": 220, "shapes": 2}


def body(rid="req_20261124_183500", **over):
    b = {"id": rid, "mask": PNG, "src": PNG, "svg": SVG, "req": dict(REQ)}
    b.update(over)
    return b


class Write(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.root)

    def test_writes_the_four_files_in_its_own_folder(self):
        rel = zr.write_request(self.root, body())
        self.assertEqual(rel, "req/req_20261124_183500")
        folder = os.path.join(self.root, "req", "req_20261124_183500")
        self.assertEqual(sorted(os.listdir(folder)), ["mask.png", "req.json", "shapes.svg", "src.png"])
        with open(os.path.join(folder, "req.json"), encoding="utf-8") as fh:
            saved = json.load(fh)
        self.assertEqual(saved["picture"], "LK19_ref_eyes.png")
        self.assertEqual(saved["id"], "req_20261124_183500")

    def test_refuses_bad_ids_bad_data_and_a_second_write(self):
        for rid in ["../x", "req_2026", "req_20261124_183500/..", "REQ_20261124_183500", None]:
            with self.assertRaises(ValueError, msg=rid):
                zr.write_request(self.root, body(rid))
        with self.assertRaises(ValueError):
            zr.write_request(self.root, body(mask=base64.b64encode(b"GIF89a").decode()))
        with self.assertRaises(ValueError):
            zr.write_request(self.root, body(svg="<html></html>"))
        with self.assertRaises(ValueError):
            zr.write_request(self.root, body(req="text"))
        for bad in ['<svg><script>alert(1)</script></svg>', '<svg onload="x()"></svg>',
                    '<svg><foreignObject></foreignObject></svg>', '<svg><a href="JavaScript:x"/></svg>',
                    '<svg><path d="x"onclick="y"/></svg>', '<svg><path/onclick="y"/></svg>',
                    '<svg><iframe/></svg>', '<svg><set attributeName="onload"/></svg>',
                    '<!DOCTYPE svg [<!ENTITY a "b">]><svg/>', '<svg><path d="M0 0" fill="&#106;"/></svg>', '<svg']:
            with self.assertRaises(ValueError, msg=bad):
                zr.write_request(self.root, body(svg=bad))
        zr.write_request(self.root, body())
        with self.assertRaises(ValueError, msg="a request is never overwritten"):
            zr.write_request(self.root, body())


class SvgFromThePage(unittest.TestCase):
    def test_the_pens_own_svg_passes(self):
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="0 0 4 4">\n'
               '<path id="p_p1" d="M0 0 C1 1 2 2 3 3 Z" fill="#8a8a92" fill-opacity="0.5" stroke="none" '
               'stroke-opacity="0.2" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>\n</svg>')
        self.assertEqual(zr._svg(svg), svg.encode("utf-8"))


class Listing(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.root)

    def answer(self, rid, answers):
        folder = os.path.join(self.root, "req", rid)
        with open(os.path.join(folder, "resp.json"), "w", encoding="utf-8") as fh:
            json.dump({"answers": answers}, fh)
        for a in answers:
            with open(os.path.join(folder, a["file"]), "wb") as fh:
                fh.write(b"\x89PNG\r\n\x1a\n")

    def test_newest_first_with_answers_whose_file_exists(self):
        zr.write_request(self.root, body("req_20261124_183500"))
        zr.write_request(self.root, body("req_20261124_190000"))
        self.answer("req_20261124_183500", [{"n": 1, "file": "result_1.png", "prompt": "red hair", "seed": 23}])
        os.makedirs(os.path.join(self.root, "req", "not_a_request"))
        got = zr.list_requests(self.root)
        self.assertEqual([r["id"] for r in got], ["req_20261124_190000", "req_20261124_183500"])
        self.assertEqual(got[0]["answers"], [])
        self.assertEqual(got[1]["answers"][0]["prompt"], "red hair")
        self.assertEqual(got[1]["subfolder"], "ZKRoto/req/req_20261124_183500")

    def test_an_answer_naming_a_missing_or_strange_file_is_left_out(self):
        zr.write_request(self.root, body())
        folder = os.path.join(self.root, "req", "req_20261124_183500")
        with open(os.path.join(folder, "resp.json"), "w", encoding="utf-8") as fh:
            json.dump({"answers": [{"n": 1, "file": "result_1.png"}, {"n": 2, "file": "../x.png"}]}, fh)
        self.assertEqual(zr.list_requests(self.root)[0]["answers"], [])

    def test_no_folder_yet_is_an_empty_list(self):
        self.assertEqual(zr.list_requests(self.root), [])


class Answer(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        zr.write_request(self.root, body())

    def tearDown(self):
        shutil.rmtree(self.root)

    def test_answers_are_numbered_and_listed(self):
        a1 = zr.write_answer(self.root, {"id": "req_20261124_183500", "png": PNG, "answer": {"prompt": "red hair",
                                                                                            "seed": 23}})
        a2 = zr.write_answer(self.root, {"id": "req_20261124_183500", "png": PNG, "answer": {"prompt": "red hair",
                                                                                            "seed": 24}})
        self.assertEqual([a1["n"], a1["file"], a2["n"], a2["file"]], [1, "result_1.png", 2, "result_2.png"])
        got = zr.list_requests(self.root)[0]["answers"]
        self.assertEqual([(a["n"], a["seed"]) for a in got], [(1, 23), (2, 24)])

    def test_refuses_unknown_request_bad_png_and_bad_answer(self):
        with self.assertRaises(ValueError):
            zr.write_answer(self.root, {"id": "req_20261124_999999", "png": PNG, "answer": {}})
        with self.assertRaises(ValueError):
            zr.write_answer(self.root, {"id": "req_20261124_183500", "png": "R0lG", "answer": {}})
        with self.assertRaises(ValueError):
            zr.write_answer(self.root, {"id": "req_20261124_183500", "png": PNG, "answer": "x"})
        self.assertEqual(zr.list_requests(self.root)[0]["answers"], [])

    def test_a_hand_edited_resp_with_a_strange_n_does_not_block_answers(self):
        folder = os.path.join(self.root, "req", "req_20261124_183500")
        with open(os.path.join(folder, "resp.json"), "w", encoding="utf-8") as fh:
            json.dump({"answers": [{"n": "x", "file": "result_9.png"}, {"n": 2, "file": "result_2.png"}]}, fh)
        self.assertEqual(zr.write_answer(self.root, {"id": "req_20261124_183500", "png": PNG, "answer": {}})["n"], 3)


if __name__ == "__main__":
    unittest.main()
