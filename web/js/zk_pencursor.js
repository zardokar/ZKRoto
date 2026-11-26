// LOGICAL (pure): the cursor says what a click will do before the click (canvas module cv_cursor.js ⑩).
// cursorFor = the table (tool, what is under the mouse, keys held) -> icon name; cursorCss = name -> CSS value
// with the hot spot, from web/constants/cursors.json (Koh's canvas icons: white ink over a dark edge).

function penCursor(kind, alt) {
  if (kind === "first") {
    return "pen_close";
  }
  if (kind === "point") {
    return alt ? "pen_curve" : "pen_del";
  }
  if (kind === "segment") {
    return "pen_add";
  }
  return "pen";
}

export function cursorFor(tool, kind, mods) {
  const m = mods || {};
  if (m.space || tool === "pan") {
    return m.dragging ? "hand_drag" : "hand_open";
  }
  if (tool === "select" || tool === "point") {
    return tool;
  }
  if (tool === "eyedrop") {
    return "eyedrop";
  }
  if (tool === "zoom") {
    return m.alt ? "zoom_out" : "zoom_in";
  }
  if (tool === "pen") {
    return penCursor(kind, !!m.alt);
  }
  return null;
}

export function cursorCss(icons, name, fallback) {
  const icon = icons && name ? icons[name] : null;
  if (!icon) {
    return fallback || "default";
  }
  return `url("${icon.uri}") ${icon.hx} ${icon.hy}, ${fallback || "default"}`;
}

function svgOf(uri) {
  return decodeURIComponent(uri.replace("data:image/svg+xml,", ""));
}

function uriOf(svg) {
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// Contrast (Koh 13:57): the page draws the cursor itself as a dark outline + the white ink inverted against the
// picture (mix-blend difference), so it never merges into a colour; this splits one cursor into those two layers.
export function splitCursor(icon) {
  const svg = svgOf(icon.uri);
  const cut = svg.indexOf('<g fill="#ffffff" stroke="#ffffff">');
  const open = svg.slice(0, svg.indexOf(">", svg.indexOf("<svg")) + 1);
  const edge = svg.slice(0, cut).replace(/fill="#000000"/g, 'fill="none"') + "</svg>";
  const ink = open + svg.slice(cut);
  return { edge: { uri: uriOf(edge), hx: icon.hx, hy: icon.hy }, ink: { uri: uriOf(ink), hx: icon.hx, hy: icon.hy } };
}
