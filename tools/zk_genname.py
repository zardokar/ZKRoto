"""Copy (never move) the pictures ComfyUI generated for a shot to frame-number names in <shot>\\gen\\<camera>, so the
guides find each frame's picture by number. Pictures are taken in counter order. README "Guides".
Usage: python tools/zk_genname.py <shot folder> <output folder> [--prefix P] [--camera NAME] [--last] [--force]"""
import argparse
import filecmp
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zk_shotfiles import find_frames, image_files  # noqa: E402


def plan(args, frames, files):
    if len(files) > len(frames) and args.last:
        files = files[-len(frames):]
    if len(files) != len(frames):
        hint = " (add --last to take the newest ones)" if len(files) > len(frames) else ""
        raise SystemExit(f"{len(files)} picture(s) in {args.output} for {len(frames)} frames{hint}; "
                         "use --prefix to pick the SaveImage prefix of this run")
    out = os.path.join(args.shot, "gen", args.camera_name)
    pairs = []
    for (n, path), src in zip(frames, files):
        base = os.path.basename(path)[:-len(".json")]
        dest = os.path.join(out, base + "_gen" + os.path.splitext(src)[1].lower())
        if os.path.exists(dest) and not filecmp.cmp(src, dest, shallow=False) and not args.force:
            raise SystemExit(f"{dest} already holds a different picture: nothing copied (add --force to replace)")
        pairs.append((src, dest))
    return out, pairs


def main(argv):
    ap = argparse.ArgumentParser(description="Copy generated pictures to frame-number names for the guides.")
    ap.add_argument("shot", help="shot folder, e.g. E:\\ComfyUI\\ComfyUI\\input\\ZKRoto\\walk01_FRA-007")
    ap.add_argument("output", help="folder ComfyUI saved the pictures in, e.g. E:\\ComfyUI\\ComfyUI\\output\\FRA-007")
    ap.add_argument("--prefix", help="SaveImage file name prefix of this run, e.g. zkroto_pose_v001a1_hands")
    ap.add_argument("--camera", help="camera name in the frame file names, 'src', or empty for the only POV camera")
    ap.add_argument("--last", action="store_true", help="more pictures than frames: take the newest by counter")
    ap.add_argument("--force", action="store_true", help="replace pictures that are already in the gen folder")
    args = ap.parse_args(argv)
    for folder in (args.shot, args.output):
        if not os.path.isdir(folder):
            raise SystemExit(f"folder not found: {folder}")
    _, args.camera_name, frames = find_frames(args.shot, args.camera)
    out, pairs = plan(args, frames, image_files(args.output, args.prefix))
    os.makedirs(out, exist_ok=True)
    for src, dest in pairs:
        shutil.copyfile(src, dest)
    with open(os.path.join(out, "gen_map.txt"), "w", encoding="utf-8", newline="\n") as f:
        f.writelines(f"{os.path.basename(s)} -> {os.path.basename(d)}\n" for s, d in pairs)
    print(f"{len(pairs)} picture(s) f{frames[0][0]:06d}-f{frames[-1][0]:06d} -> {out}")


if __name__ == "__main__":
    main(sys.argv[1:])
