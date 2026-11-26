// VIEW: the icons of the request group, the Claude bar and the compare panel (24 x 24 stroke icons; z-ui icon table,
// wireframes wf_zkreq_3 and wf_zkapi_3; the key is our own drawing). Colour = currentColor, so the theme decides it.
const HEAD = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="';

const PATHS = {
  svg: "M12 4v11 M7 10l5 5 5-5 M5 20h14",
  send: "M4 12l16-8-6 16-3-6z M11 14l9-10",
  compare: "M3 5h8v14H3z M13 5h8v14h-8z",
  side: "M3 5h8v14H3z M13 5h8v14h-8z",
  wipe: "M3 5h18v14H3z M12 3v18 M8 12H6 M16 12h2",
  back: "M15 6l-6 6 6 6",
  next: "M9 6l6 6-6 6",
  close: "M6 6l12 12 M18 6L6 18",
  import: "M12 20V9 M7 14l5-5 5 5 M5 4h14",
  key: "M4 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M12 12h9 M18 12v3 M21 12v2",
  refresh: "M20 12a8 8 0 1 1-2.3-5.6 M20 4v5h-5",
  down: "M6 9l6 6 6-6",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
  check: "M5 12l5 5 9-10",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13",
  ext: "M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6",
  mask: "M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.6 7.6",
  roto: "M12 3a2 2 0 1 0 0 4a2 2 0 1 0 0-4 M12 7v8 M7 10h10 M12 15l-3.5 6 M12 15l3.5 6",
  go: "M5 12h14 M13 6l6 6-6 6",
  open: "M3 6h6l2 2h10v11H3z",
  b30: "M11 6l-6 6 6 6 M19 6l-6 6 6 6",
  f30: "M5 6l6 6-6 6 M13 6l6 6-6 6",
  camera: "M4 8h4l2-3h4l2 3h4v11H4z M9 13a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
  movepoint: "M12 2v6 M12 16v6 M2 12h6 M16 12h6 M10 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
  reset: "M4 12a8 8 0 1 0 2.3-5.7 M4 4v5h5",
};

// The progress border of a button (Koh 2026-11-25 21:0x: it runs on the button's own rounded square, not a circle).
export function ring() {
  return '<svg class="zk-req-ringsvg" aria-hidden="true"><rect pathLength="100"/></svg>';
}

export function icon(name) {
  return HEAD + PATHS[name] + '"/></svg>';
}
