// LOGICAL (pure): undo / redo of the pen doc, the rules of Koh's canvas module (cv_history.js, cv_tools.js
// cvHistStep): one finished action = one step, a new action kills the redo line, at most `max` steps, undo clears
// the choice. ZKRoto keeps snapshots of the paths (the doc is one flat list) instead of the canvas command objects.

export function newHistory(max) {
  return { undo: [], redo: [], last: null, max: max > 0 ? max : 50 };
}

function snap(st) {
  return JSON.stringify(st.doc.paths);
}

// A new picture: no history; the doc as it is now is the start.
export function resetHistory(h, st) {
  h.undo = [];
  h.redo = [];
  h.last = snap(st);
}

// Called when an action may have ended. An open line or a drag still running is one gesture (no step yet); a doc
// that did not change (Esc on an open line, a click on nothing) takes no step.
export function settle(h, st) {
  if (st.pen || st.grab) {
    return false;
  }
  const now = snap(st);
  if (h.last === null || now === h.last) {
    h.last = now;
    return false;
  }
  h.undo.push(h.last);
  h.redo = [];
  while (h.undo.length > h.max) {
    h.undo.shift();
  }
  h.last = now;
  return true;
}

// The ids counter (doc.seq) is not restored, so an id never comes back after an undo.
export function stepHistory(h, st, back) {
  settle(h, st);
  const from = back ? h.undo : h.redo;
  if (!from.length) {
    return false;
  }
  const to = back ? h.redo : h.undo;
  to.push(h.last);
  h.last = from.pop();
  st.doc.paths = JSON.parse(h.last);
  Object.assign(st, { selected: null, active: null, grab: null, undone: [] });
  return true;
}
