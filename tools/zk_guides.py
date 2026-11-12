"""Guides for the vector step: one SVG per exported frame (MediaPipe 33, body axes, face 70, hidden OpenPose 18, at
exact pixels, locked Inkscape layers), optionally over the generated picture of that frame. README "Guides".
Usage: python tools/zk_guides.py <shot folder> [--camera NAME] [--images DIR] [--min-vis 0.3] [--out DIR]"""
import argparse
import json
import os
import re
import sys
from xml.sax.saxutils import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from zk_shotfiles import find_frames, pictures  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NS = ('xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
      'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"')
AXES = (("axis_shoulders", 11, 12), ("axis_hips", 23, 24))
SHADOW = "#111111"


def constants():
    with open(os.path.join(HERE, "web", "constants", "zkroto.json"), encoding="utf-8") as f:
        k = json.load(f)
    with open(os.path.join(HERE, "web", "js", "zk_openpose.js"), encoding="utf-8") as f:
        limbs = json.loads(re.search(r"LIMBS = (\[.*?\]);", f.read(), re.S).group(1))
    return k, limbs


def slug(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def rgb(c):
    return f"rgb({c[0]},{c[1]},{c[2]})"


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def triples(flat):
    return [flat[i:i + 3] for i in range(0, len(flat), 3)]


def layer(label, body, hidden=False):
    style = ' style="display:none"' if hidden else ""
    return (f'<g inkscape:groupmode="layer" inkscape:label="{label}" id="{slug(label)}" sodipodi:insensitive="true"'
            f'{style}>\n{body}</g>\n')


def mp_parts(points, k, min_vis):
    names, sides, conns = k["mpNames"], k["mpSides"], k["mpConnections"]
    colors = {"l": k["colors"]["sheet"]["left"], "r": k["colors"]["sheet"]["right"], "c": k["colors"]["sheet"]["center"]}
    ok = [p[2] >= min_vis for p in points]
    bones = "".join(
        f'<line x1="{points[a][0]}" y1="{points[a][1]}" x2="{points[b][0]}" y2="{points[b][1]}" '
        f'stroke="{colors[sides[b]]}" stroke-width="1.5"/>\n' for a, b in conns if ok[a] and ok[b])
    joints, low = "", ""
    for i, p in enumerate(points):
        jid = f"mp_{i:02d}_{slug(names[i])}"
        if ok[i]:
            joints += (f'<circle id="{jid}" cx="{p[0]}" cy="{p[1]}" r="2.5" fill="{colors[sides[i]]}">'
                       f'<title>{escape(names[i])} (vis {p[2]:.2f})</title></circle>\n')
        else:
            low += f'<circle id="{jid}" cx="{p[0]}" cy="{p[1]}" r="3" fill="none" stroke="#888888"/>\n'
    return bones, joints, low


def axes_part(points, k, min_vis):
    """Shoulder line, hip line and the spine between their midpoints, from MediaPipe; light dashes over a dark
    outline so they read on the white generated frames and on black (OpenPose 18 is hidden)."""
    color, out, mids = k["colors"]["sheet"]["center"], "", {}

    def line(lid, x1, y1, x2, y2):
        xy = f'x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"'
        return (f'<line {xy} stroke="{SHADOW}" stroke-width="4" stroke-opacity="0.75"/>\n'
                f'<line id="{lid}" {xy} stroke="{color}" stroke-width="2" stroke-dasharray="6 3"/>\n')
    for name, a, b in AXES:
        if points[a][2] >= min_vis and points[b][2] >= min_vis:
            pa, pb = points[a], points[b]
            out += line(name, pa[0], pa[1], pb[0], pb[1])
            mids[name] = ((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2)
    if len(mids) == 2:
        out += line("axis_spine", *mids["axis_shoulders"], *mids["axis_hips"])
    for name, key in (("axis_shoulder_mid", "axis_shoulders"), ("axis_hip_mid", "axis_hips")):
        if key in mids:
            out += (f'<circle id="{name}" cx="{mids[key][0]}" cy="{mids[key][1]}" r="3.5" fill="{color}" '
                    f'stroke="{SHADOW}" stroke-width="1.5"/>\n')
    return out


def op_parts(op, k, limbs):
    pts = triples(op)
    cols = k["colors"]["openpose"]
    bones = "".join(
        f'<line x1="{pts[a][0]}" y1="{pts[a][1]}" x2="{pts[b][0]}" y2="{pts[b][1]}" stroke="{rgb(cols[i])}" '
        f'stroke-width="3" stroke-opacity="0.6"/>\n' for i, (a, b) in enumerate(limbs) if pts[a][2] > 0 and pts[b][2] > 0)
    joints = ""
    for i, p in enumerate(pts):
        if p[2] > 0:
            name = k["opNames"][i]
            joints += (f'<circle id="op_{i:02d}_{slug(name)}" cx="{p[0]}" cy="{p[1]}" r="4" fill="none" '
                       f'stroke="{rgb(cols[i])}" stroke-width="1.5"><title>{escape(name)}</title></circle>\n')
    return bones, joints


def face_part(path):
    if not os.path.exists(path):
        return None
    people = load(path).get("people") or [{}]
    pts = triples(people[0].get("face_keypoints_2d", []))
    return "".join(f'<circle id="face_{i:02d}" cx="{p[0]}" cy="{p[1]}" r="1.5" fill="#ffffff" stroke="#000000" '
                   f'stroke-width="0.5"/>\n' for i, p in enumerate(pts) if p[2] > 0)


def info_part(shot, base, frame, camera, w):
    zk = os.path.join(shot, "zkroto", re.sub(r"_f(\d+)_.*$", r"_f\1.json", base))
    cam = load(zk).get("cameras", {}).get(camera, {}) if os.path.exists(zk) else {}
    parts = [f"f{frame:06d}", camera]
    if cam.get("range"):
        parts.append(f"range {cam['range'][0]}-{cam['range'][1]}")
    if cam.get("fit"):
        fit = cam["fit"]
        parts.append(f"fit s {fit['s']:.4g} tx {fit['tx']:.4g} ty {fit['ty']:.4g}")
    return f'<text x="{w - 8}" y="18" font-family="monospace" font-size="12" text-anchor="end" fill="#888888">' \
           f'{escape("  ".join(parts))}</text>\n'


def frame_svg(args, k, limbs, side, camera, frame, path, image):
    op_json = load(path)
    w, h = op_json["canvas_width"], op_json["canvas_height"]
    base = os.path.basename(path)
    mp = load(os.path.join(args.shot, "mediapipe", side, base))["points"]
    mp_bones, mp_joints, low = mp_parts(mp, k, args.min_vis)
    op_bones, op_joints = op_parts(op_json["people"][0]["pose_keypoints_2d"], k, limbs)
    out = [f'<svg {NS} width="{w}" height="{h}" viewBox="0 0 {w} {h}">\n']
    if image:
        rel = os.path.relpath(image, args.out).replace(os.sep, "/")
        out.append(layer("generated", f'<image xlink:href="{escape(rel)}" x="0" y="0" width="{w}" height="{h}"/>\n'))
    out.append(layer("mediapipe 33 bones", mp_bones))
    out.append(layer("openpose 18", op_bones + op_joints, hidden=True))
    out.append(layer("body axes", axes_part(mp, k, args.min_vis)))
    out.append(layer("joints", mp_joints))
    face = face_part(os.path.join(args.shot, "openpose", "face", side, base))
    if face is not None:
        out.append(layer("face 70", face))
    out.append(layer("low visibility", low, hidden=True))
    out.append(layer("info", info_part(args.shot, base, frame, camera, w)))
    out.append("</svg>\n")
    name = base[:-len(".json")] + ".svg"
    with open(os.path.join(args.out, name), "w", encoding="utf-8", newline="\n") as f:
        f.write("".join(out))
    return name


def main(argv):
    ap = argparse.ArgumentParser(description="SVG guide layers for the vector step, one file per frame.")
    ap.add_argument("shot", help="shot folder, e.g. E:\\ComfyUI\\ComfyUI\\input\\ZKRoto\\walk01_FRA-007")
    ap.add_argument("--camera", help="camera name in the file names, 'src', or empty for the only POV camera")
    ap.add_argument("--images", help="folder of generated pictures (default <shot>\\gen\\<camera> when it exists); "
                    "matched by the frame number in the names, else in name order; \"\" for none")
    ap.add_argument("--min-vis", type=float, default=0.3, help="MediaPipe points below this go to 'low visibility'")
    ap.add_argument("--out", help="output folder (default <shot>\\guides\\<camera>)")
    args = ap.parse_args(argv)
    if not os.path.isdir(args.shot):
        raise SystemExit(f"shot folder not found: {args.shot}")
    k, limbs = constants()
    side, camera, frames = find_frames(args.shot, args.camera)
    args.out = args.out or os.path.join(args.shot, "guides", camera)
    os.makedirs(args.out, exist_ok=True)
    gen = os.path.join(args.shot, "gen", camera)
    if args.images is None and os.path.isdir(gen):
        args.images = gen
    images, note = pictures(args.images, frames)
    for (frame, path), image in zip(frames, images):
        frame_svg(args, k, limbs, side, camera, frame, path, image)
    print(f"{len(frames)} guide(s) f{frames[0][0]:06d}-f{frames[-1][0]:06d} -> {args.out}" + (f" ({note})" if note else ""))


if __name__ == "__main__":
    main(sys.argv[1:])
