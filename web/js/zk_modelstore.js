// LOGICAL: the Claude key, the model list (fetched once a day) and the chosen model, kept in this browser only
// (Koh 2026-11-25 21:0x: localStorage, like TypingMind). Every read / write is wrapped: storage can throw.
const KEYS = { key: "zkroto.claudeKey", models: "zkroto.claudeModels", chosen: "zkroto.claudeModel" };
const SHOWN = 4;

function read(store, name) {
  try {
    return store.getItem(name);
  } catch (_e) {
    return null;
  }
}

function write(store, name, value) {
  try {
    if (value === null) {
      store.removeItem(name);
    } else {
      store.setItem(name, value);
    }
  } catch (_e) {
    return;
  }
}

export function maskKey(key) {
  return key ? "••••" + key.slice(-SHOWN) : "";
}

// The chosen model if it is still in the list, else the first that names the preferred line, else the first.
export function pickModel(models, chosen, prefer) {
  if (models.some((m) => m.id === chosen)) {
    return chosen;
  }
  const liked = models.find((m) => m.id.includes(prefer));
  return liked ? liked.id : (models[0] ? models[0].id : "");
}

export function createModelStore(store) {
  function saved() {
    try {
      return JSON.parse(read(store, KEYS.models) || "null") || { day: "", list: [] };
    } catch (_e) {
      return { day: "", list: [] };
    }
  }
  return {
    key: function () {
      return read(store, KEYS.key) || "";
    },
    setKey: function (key) {
      write(store, KEYS.key, String(key || "").trim() || null);
    },
    clearKey: function () {
      write(store, KEYS.key, null);
    },
    models: function () {
      return saved().list;
    },
    day: function () {
      return saved().day;
    },
    saveModels: function (list, day) {
      write(store, KEYS.models, JSON.stringify({ day, list }));
    },
    due: function (day) {
      return saved().day !== day;
    },
    chosen: function () {
      return read(store, KEYS.chosen) || "";
    },
    choose: function (id) {
      write(store, KEYS.chosen, id);
    },
  };
}
