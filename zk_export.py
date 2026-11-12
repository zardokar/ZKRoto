"""ZKRoto export rules: which files the page may write into input/ZKRoto/<shot>_<character>/ and how.

Pure module (no ComfyUI or aiohttp import) so it can be tested alone (atdd/test_zk_export.py).
Design: ComfyUIAssistant docs/zkroto-0.2-design.md section 6.
"""
import base64
import json
import os
import re
import tempfile

PART = r"[A-Za-z0-9-]+"
FOLDER_RE = re.compile(rf"{PART}(?:_{PART})?")
POV = r"pov_y[0-9]{3}_h[0-9]{3}_d[0-9]{3}_f[0-9]{2,3}(?:_rm?[0-9]{1,2})?(?:_L|_c[0-9]{2,4}x[0-9]{2,4})?"
CAMERA_RE = re.compile(rf"(?:src|{POV})")
# Windows device names and the Capture folder cannot be a shot (first part of the folder name, any case)
RESERVED = re.compile(r"(?:con|prn|aux|nul|com[0-9]|lpt[0-9]|capture)", re.IGNORECASE)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
MAX_FILES = 20

# sub folder -> file name pattern after "<folder>_" ({cam} = the camera part)
RULES = {
    "openpose/src": r"f[0-9]+_src\.(?:png|json)",
    "openpose/pov": rf"f[0-9]+_{POV}\.(?:png|json)",
    "mediapipe/src": r"f[0-9]+_src\.json",
    "mediapipe/pov": rf"f[0-9]+_{POV}\.json",
    "openpose/face/src": r"f[0-9]+_src\.(?:png|json)",
    "openpose/face/pov": rf"f[0-9]+_{POV}\.(?:png|json)",
    "mediapipe/face/src": r"f[0-9]+_src\.json",
    "mediapipe/face/pov": rf"f[0-9]+_{POV}\.json",
    "openpose/full/src": r"f[0-9]+_src\.png",
    "openpose/full/pov": rf"f[0-9]+_{POV}\.png",
    "mediapipe": rf"sheet_(?:src|{POV})\.png",
    "zkroto": r"(?:f[0-9]+|shot|edits)\.json",
}


def check_folder(folder):
    if not isinstance(folder, str) or not FOLDER_RE.fullmatch(folder):
        return False
    return not RESERVED.fullmatch(folder.split("_")[0])


def check_camera(camera):
    return isinstance(camera, str) and bool(CAMERA_RE.fullmatch(camera))


def check_file(folder, sub, name):
    rule = RULES.get(sub)
    if rule is None or not check_folder(folder) or not isinstance(name, str):
        return False
    return re.fullmatch(re.escape(folder) + "_" + rule, name) is not None


def _target(root, folder, sub, name):
    if not check_file(folder, sub, name):
        raise ValueError(f"name not allowed: {sub}/{name}")
    top = os.path.realpath(root)
    base = os.path.join(top, folder)
    path = os.path.realpath(os.path.join(base, *sub.split("/"), name))
    if os.path.commonpath([base, path]) != base:
        raise ValueError(f"outside the shot folder: {sub}/{name}")
    return path


def _payload(item):
    name = item.get("name", "")
    if name.endswith(".png"):
        if not isinstance(item.get("png"), str):
            raise ValueError(f"{name}: png data missing")
        data = base64.b64decode(item["png"], validate=True)
        if not data.startswith(PNG_SIGNATURE):
            raise ValueError(f"{name}: not a PNG")
        return data
    if "json" not in item:
        raise ValueError(f"{name}: json data missing")
    return (json.dumps(item["json"], ensure_ascii=False, indent=1) + "\n").encode("utf-8")


def _write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def write_files(root, folder, files):
    """Check every file first, then write them all; returns paths relative to root ("<folder>/<sub>/<name>")."""
    if not check_folder(folder):
        raise ValueError(f"folder not allowed: {folder!r}")
    if not isinstance(files, list) or not 0 < len(files) <= MAX_FILES:
        raise ValueError("files: 1 .. 20 entries")
    jobs = []
    for item in files:
        path = _target(root, folder, item.get("sub"), item.get("name"))
        jobs.append((path, _payload(item), f"{folder}/{item['sub']}/{item['name']}"))
    for path, data, rel in jobs:
        try:
            _write(path, data)
        except OSError as e:
            raise ValueError(f"cannot write {rel}: {e.strerror}") from e
    return [rel for _path, _data, rel in jobs]


def read_json(root, folder, sub, name):
    path = _target(root, folder, sub, name)
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def sheet_data(root, folder, camera):
    """The MediaPipe JSON of every exported frame of one camera, in frame order."""
    if not check_folder(folder) or not check_camera(camera):
        raise ValueError(f"not allowed: {folder!r} {camera!r}")
    sub = "mediapipe/src" if camera == "src" else "mediapipe/pov"
    pattern = re.compile(re.escape(folder) + r"_f([0-9]+)_" + re.escape(camera) + r"\.json")
    base = os.path.join(root, folder, *sub.split("/"))
    if not os.path.isdir(base):
        return []
    found = sorted((int(m.group(1)), n) for n in os.listdir(base) if (m := pattern.fullmatch(n)))
    return [read_json(root, folder, sub, n) for _frame, n in found]
