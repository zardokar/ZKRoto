"""ZKRoto - video frame viewer and capture page for ComfyUI.

Serves a standalone page at http://127.0.0.1:8188/zkroto/ (not a ComfyUI
frontend extension: nothing is injected into the main UI). The page loads an
mp4 from ComfyUI's input folder (or a local file), steps frame by frame,
captures frames as PNG into input/ZKRoto/capture/<video>/ via /upload/image, runs
MediaPipe Pose on a frame (library in third-party/, served at /zkroto_lib/), and
exports the pose of a frame (OpenPose 18 PNG + JSON, MediaPipe 33 JSON, sheets,
our records) into input/ZKRoto/<shot>_<character>/ through POST /zkroto/export.

This module adds no nodes.
"""
import logging
import mimetypes
import os

import folder_paths
from aiohttp import web
from server import PromptServer

from .zk_export import read_json, sheet_data, write_files

APP = "ZKRoto"          # display name; captures go to input/<APP>/
SLUG = "zkroto"         # URL: /<SLUG>/ page, /<SLUG>_lib/ third-party files
VERSION = "0.3.0"

_here = os.path.dirname(os.path.abspath(__file__))
_web = os.path.join(_here, "web")
_lib = os.path.join(_here, "third-party")

# Module scripts and wasm need correct MIME types; the Windows registry can map
# them wrongly. Only add a mapping when the current guess is wrong.
for _ext, _type in ((".mjs", "text/javascript"), (".js", "text/javascript"), (".wasm", "application/wasm")):
    _guess = mimetypes.guess_type("x" + _ext)[0]
    if _guess not in (_type, "application/javascript"):
        mimetypes.add_type(_type, _ext)

_routes = PromptServer.instance.routes


def _to_index(request):
    # keep the query string (?video=...&frame=...)
    qs = request.query_string
    raise web.HTTPFound(f"/{SLUG}/index.html" + (f"?{qs}" if qs else ""))


@_routes.get(f"/{SLUG}")
async def _zkroto_root(request):
    _to_index(request)


# Registered before the static route: aiohttp's static handler answers a bare
# directory path ("/zkroto/") with 403 (no directory index).
@_routes.get(f"/{SLUG}/")
async def _zkroto_dir(request):
    _to_index(request)


@_routes.get(f"/{SLUG}/version")
async def _zkroto_version(request):
    return web.json_response({"name": APP, "version": VERSION})


def _root():
    return os.path.join(folder_paths.get_input_directory(), APP)


def _bad(e):
    return web.json_response({"error": str(e)}, status=400)


# Writes only under input/ZKRoto/<shot>_<character>/ (rules and tests: zk_export.py, atdd/test_zk_export.py).
@_routes.post(f"/{SLUG}/export")
async def _zkroto_export(request):
    try:
        body = await request.json()
        written = write_files(_root(), body.get("folder"), body.get("files"))
    except (ValueError, TypeError, AttributeError) as e:
        return _bad(e)
    return web.json_response({"folder": body["folder"], "written": [f"{APP}/{w}" for w in written]})


@_routes.get(f"/{SLUG}/shot")
async def _zkroto_shot(request):
    folder = request.query.get("folder", "")
    name = request.query.get("frame", "")
    try:
        shot = read_json(_root(), folder, "zkroto", f"{folder}_shot.json")
        frame = read_json(_root(), folder, "zkroto", name) if name else None
    except ValueError as e:
        return _bad(e)
    return web.json_response({"shot": shot, "frame": frame})


@_routes.get(f"/{SLUG}/sheetdata")
async def _zkroto_sheetdata(request):
    try:
        frames = sheet_data(_root(), request.query.get("folder", ""), request.query.get("camera", ""))
    except ValueError as e:
        return _bad(e)
    return web.json_response({"frames": frames})


_routes.static(f"/{SLUG}_lib", _lib)
_routes.static(f"/{SLUG}", _web)

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

logging.info("[%s] %s page at /%s/", APP, VERSION, SLUG)
