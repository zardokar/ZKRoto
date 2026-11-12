"""Shared by the shot tools: find the exported frames of one camera, and match generated pictures to them
(by the frame number in the picture name when every name has one, else in name order). README "Guides"."""
import glob
import os
import re

IMAGE_EXT = (".png", ".jpg", ".jpeg", ".webp")
FRAME_RE = re.compile(r"_f(\d+)_(.+)\.json$")
PIC_FRAME_RE = re.compile(r"_f(\d+)_")


def natural(name):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", name)]


def image_files(folder, prefix=None):
    names = [n for n in os.listdir(folder) if n.lower().endswith(IMAGE_EXT)]
    if prefix:
        names = [n for n in names if n.startswith(prefix + "_")]
    return [os.path.join(folder, n) for n in sorted(names, key=natural)]


def find_frames(shot, camera):
    side = "src" if camera == "src" else "pov"
    files = glob.glob(os.path.join(shot, "openpose", side, "*.json"))
    cams = sorted({FRAME_RE.search(os.path.basename(p)).group(2) for p in files if FRAME_RE.search(p)})
    if not cams:
        raise SystemExit(f"no exported frames in {os.path.join(shot, 'openpose', side)}")
    if camera in (None, "pov"):
        if len(cams) > 1:
            raise SystemExit(f"more than one POV camera ({', '.join(cams)}): choose one with --camera")
        camera = cams[0]
    picked = [p for p in files if FRAME_RE.search(p) and FRAME_RE.search(p).group(2) == camera]
    if not picked:
        raise SystemExit(f"no frames for camera {camera} (found: {', '.join(cams)})")
    frames = sorted((int(FRAME_RE.search(p).group(1)), p) for p in picked)
    return side, camera, frames


def pictures(folder, frames):
    """One picture path (or None) per frame, and a short note on how they were matched."""
    if not folder:
        return [None] * len(frames), ""
    if not os.path.isdir(folder):
        raise SystemExit(f"pictures folder not found: {folder}")
    files = image_files(folder)
    numbers = [PIC_FRAME_RE.search(os.path.basename(p)) for p in files]
    if files and all(numbers):
        by_frame = {int(m.group(1)): p for m, p in zip(numbers, files)}
        picked = [by_frame.get(n) for n, _ in frames]
        missing = [f"f{n:06d}" for (n, _), p in zip(frames, picked) if p is None]
        note = f"{len(frames) - len(missing)} picture(s) matched by frame number"
        return picked, note + (f"; no picture for {', '.join(missing)}" if missing else "")
    if len(files) != len(frames):
        raise SystemExit(f"{len(files)} picture(s) in {folder} for {len(frames)} frames: names without frame numbers "
                         "are matched in order, so the counts must be equal (or name them with tools/zk_genname.py)")
    return files, f"{len(files)} picture(s) matched in name order"
