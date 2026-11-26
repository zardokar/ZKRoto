"""ZKRoto requests to Claude: the page writes one request folder, Claude writes the answers into it.

input/ZKRoto/req/<id>/: mask.png (drawn shapes, white on black, picture size), src.png (the picture shown),
shapes.svg (the shapes), req.json (picture name, size, shape count). Claude adds result_<n>.png and resp.json
({"answers": [{n, file, prompt, seed, ...}]}, through write_answer). Pure module (no ComfyUI or aiohttp import), tests:
atdd/test_zk_request.py. Design: ZComfy .dropzone/lab/20261124_zkreq/ (Koh 2026-11-24 15:37-16:24).
"""
import base64
import json
import os
import re
from xml.etree import ElementTree

try:
    from .zk_export import PNG_SIGNATURE, _write
except ImportError:  # loaded as a top-level module by the tests
    from zk_export import PNG_SIGNATURE, _write

ID_RE = re.compile(r"req_[0-9]{8}_[0-9]{6}")
RESULT_RE = re.compile(r"result_[0-9]{1,3}\.png")
# shapes.svg holds only what zk_pensvg.js writes (svg + path, fixed attributes); anything else is refused, so the
# file can never run code when opened in a browser (review 2026-11-24).
SVG_NS = "{http://www.w3.org/2000/svg}"
SVG_ALLOWED = {
    "svg": {"width", "height", "viewBox"},
    "path": {"id", "d", "fill", "fill-opacity", "stroke", "stroke-opacity", "stroke-width", "stroke-linejoin",
             "stroke-linecap"},
}
SUB = "req"
APP = "ZKRoto"


def _png(name, text):
    if not isinstance(text, str):
        raise ValueError(f"{name}: png data missing")
    data = base64.b64decode(text, validate=True)
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError(f"{name}: not a PNG")
    return data


def _svg(text):
    if not isinstance(text, str) or not text.lstrip().startswith("<svg") or "<!" in text or "&" in text:
        raise ValueError("shapes.svg: not a plain SVG")
    try:
        top = ElementTree.fromstring(text)
    except ElementTree.ParseError as e:
        raise ValueError(f"shapes.svg: {e}") from e
    for node in top.iter():
        tag = node.tag.replace(SVG_NS, "")
        if tag not in SVG_ALLOWED or not set(node.attrib) <= SVG_ALLOWED[tag]:
            raise ValueError(f"shapes.svg: <{tag}> or its attributes are not allowed")
    return text.encode("utf-8")


def _folder(root, rid):
    if not isinstance(rid, str) or not ID_RE.fullmatch(rid):
        raise ValueError(f"request id not allowed: {rid!r}")
    return os.path.join(os.path.realpath(root), SUB, rid)


def write_request(root, body):
    """Check everything first, then write the four files; returns "req/<id>". A request is never overwritten."""
    if not isinstance(body, dict):
        raise ValueError("body must be an object")
    folder = _folder(root, body.get("id"))
    if os.path.exists(folder):
        raise ValueError(f"request exists: {body['id']}")
    if not isinstance(body.get("req"), dict):
        raise ValueError("req.json must be an object")
    req = dict(body["req"], id=body["id"])
    files = {
        "mask.png": _png("mask.png", body.get("mask")),
        "src.png": _png("src.png", body.get("src")),
        "shapes.svg": _svg(body.get("svg")),
        "req.json": (json.dumps(req, ensure_ascii=False, indent=1) + "\n").encode("utf-8"),
    }
    for name, data in files.items():
        try:
            _write(os.path.join(folder, name), data)
        except OSError as e:
            raise ValueError(f"cannot write {name}: {e.strerror}") from e
    return f"{SUB}/{body['id']}"


def write_answer(root, body):
    """Claude's answer to a request: result_<n>.png (n = next free) + one entry in resp.json; returns the entry."""
    if not isinstance(body, dict) or not isinstance(body.get("answer"), dict):
        raise ValueError("answer must be an object")
    folder = _folder(root, body.get("id"))
    if not os.path.isdir(folder):
        raise ValueError(f"no such request: {body['id']}")
    data = _png("result", body.get("png"))
    resp = _read(os.path.join(folder, "resp.json"))
    answers = resp.get("answers", []) if isinstance(resp, dict) else []
    n = 1 + max([a["n"] for a in answers if isinstance(a, dict) and isinstance(a.get("n"), int)] + [0])
    entry = dict(body["answer"], n=n, file=f"result_{n}.png")
    try:
        _write(os.path.join(folder, entry["file"]), data)
        text = json.dumps({"answers": answers + [entry]}, ensure_ascii=False, indent=1) + "\n"
        _write(os.path.join(folder, "resp.json"), text.encode("utf-8"))
    except OSError as e:
        raise ValueError(f"cannot write the answer: {e.strerror}") from e
    return entry


def _read(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def _answers(folder):
    resp = _read(os.path.join(folder, "resp.json")) or {}
    good = []
    for a in resp.get("answers", []) if isinstance(resp, dict) else []:
        name = a.get("file") if isinstance(a, dict) else None
        if isinstance(name, str) and RESULT_RE.fullmatch(name) and os.path.isfile(os.path.join(folder, name)):
            good.append(a)
    return good


def list_requests(root):
    """Every request, newest first, with its answers whose result file exists."""
    base = os.path.join(os.path.realpath(root), SUB)
    if not os.path.isdir(base):
        return []
    out = []
    for rid in sorted((n for n in os.listdir(base) if ID_RE.fullmatch(n)), reverse=True):
        folder = os.path.join(base, rid)
        out.append({"id": rid, "subfolder": f"{APP}/{SUB}/{rid}", "req": _read(os.path.join(folder, "req.json")),
                    "answers": _answers(folder)})
    return out
