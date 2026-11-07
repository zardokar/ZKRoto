"""ZKRoto - video frame viewer and capture page for ComfyUI.

Serves a standalone page at http://127.0.0.1:8188/zkroto/ (not a ComfyUI
frontend extension: nothing is injected into the main UI). The page loads an
mp4 from ComfyUI's input folder (or a local file), steps frame by frame,
captures frames as PNG into input/ZKRoto/<video>/ via /upload/image, and can
run MediaPipe Pose on a frame (library in third-party/, served at /zkroto_lib/).

This module adds no nodes.
"""
import logging
import mimetypes
import os

from aiohttp import web
from server import PromptServer

APP = "ZKRoto"          # display name; captures go to input/<APP>/
SLUG = "zkroto"         # URL: /<SLUG>/ page, /<SLUG>_lib/ third-party files
VERSION = "0.1.3"

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


_routes.static(f"/{SLUG}_lib", _lib)
_routes.static(f"/{SLUG}", _web)

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

logging.info("[%s] %s page at /%s/", APP, VERSION, SLUG)
