// Store: single localStorage-backed state object.
// { base: [{id,name,color,icon,tasks:[{id,name,min,freq}]}], quests: [{id,name,active,color,icon,added:[...],modified:[...]}], completions: [{id,taskId,kind,date,actualMin}] }
(function () {
  "use strict";

  var KEY = "rozcestnik:v1";

  // id -> fixed identity (color/icon survive renames and array reordering).
  var ROOM_META = {
    "room-kuchyn":   { color: "kitchen",  icon: "i-kuchyn" },
    "room-obyvak":   { color: "living",   icon: "i-obyvak" },
    "room-loznice":  { color: "bedroom",  icon: "i-loznice" },
    "room-koupelna": { color: "bath",     icon: "i-koupelna" },
    "room-chodba":   { color: "hall",     icon: "i-chodba" },
    "room-rn6ka2":   { color: "kids",     icon: "i-pokojicek" },
    "room-auto":     { color: "car",      icon: "i-car" },
    "room-zahrada":  { color: "garden",   icon: "i-plant" }
  };
  var QUEST_META = {
    "quest-vanoce":     { color: "xmas-green", icon: "i-tree" },
    "quest-velikonoce": { color: "easter",     icon: "i-egg" },
    "quest-beltain":    { color: "beltain",    icon: "i-flower" },
    "quest-halloween":  { color: "hall-o",     icon: "i-ghost" },
    "quest-narozeniny": { color: "bday",       icon: "i-balloon" }
  };
  var FALLBACK_ROOM_COLORS = ["kitchen", "living", "bedroom", "bath", "hall", "kids", "car", "garden"];

  var SEED = {
    base: [
      { id: "room-kuchyn", name: "Kuchyň", color: "kitchen", icon: "i-kuchyn", tasks: [
        { id: "t1", name: "Umýt nádobí, které nepatří do myčky", min: 5, freq: "denne" },
        { id: "t2", name: "Utřít pracovní desku a sporák", min: 10, freq: "denne" },
        { id: "t3", name: "Vynést odpadky", min: 5, freq: "dle_potreby" },
        { id: "t4", name: "Vytřít podlahu", min: 15, freq: "tydne" },
        { id: "t5", name: "Vyčistit ledničku", min: 20, freq: "tydne" },
        { id: "t-blusep", name: "Vysát", min: 10, freq: "tydne" },
        { id: "t-q4u1ri", name: "Vyskládat myčku", min: 10, freq: "denne" },
        { id: "t-7l3bcx", name: "Naskládat myčku", min: 10, freq: "denne" },
        { id: "t-56n1as", name: "Vytřídit věci z ledničky", min: 10, freq: "tydne" },
        { id: "t-c8sdgp", name: "Umýt troubu", min: 15, freq: "tydne" },
        { id: "t-l5c9pp", name: "Vyčištění myčky", min: 90, freq: "ctvrtletne" },
        { id: "t-6h9w1r", name: "Vyčištění pračky", min: 90, freq: "ctvrtletne" }
      ]},
      { id: "room-obyvak", name: "Obývák", color: "living", icon: "i-obyvak", tasks: [
        { id: "t6", name: "Utřít prach", min: 15, freq: "tydne" },
        { id: "t7", name: "Vysát", min: 15, freq: "tydne" },
        { id: "t8", name: "Srovnat polštáře a deky", min: 5, freq: "denne" },
        { id: "t9", name: "Umýt okna", min: 25, freq: "ctvrtletne" },
        { id: "t-0fwfc5", name: "Vytřít", min: 10, freq: "tydne" },
        { id: "t-gt1zdm", name: "Poskládat věci", min: 10, freq: "denne" }
      ]},
      { id: "room-loznice", name: "Ložnice", color: "bedroom", icon: "i-loznice", tasks: [
        { id: "t10", name: "Ustlat postel", min: 10, freq: "denne" },
        { id: "t11", name: "Vyvětrat", min: 5, freq: "denne" },
        { id: "t12", name: "Vyměnit povlečení", min: 15, freq: "tydne" },
        { id: "t13", name: "Utřít prach a vysát", min: 15, freq: "tydne" },
        { id: "t-v07h95", name: "Uklidit oblečení", min: 10, freq: "denne" },
        { id: "t-3lnkv4", name: "Uklidit parapet", min: 10, freq: "tydne" }
      ]},
      { id: "room-koupelna", name: "Koupelna", color: "bath", icon: "i-koupelna", tasks: [
        { id: "t14b", name: "Rychlý úklid umyvadla a WC", min: 10, freq: "denne" },
        { id: "t15", name: "Umýt sprchu/vanu", min: 15, freq: "tydne" },
        { id: "t16", name: "Vytřít podlahu", min: 10, freq: "tydne" },
        { id: "t17", name: "Vyprat ručníky", min: 5, freq: "tydne" },
        { id: "t-o61nks", name: "Vysát podlahu", min: 10, freq: "tydne" },
        { id: "t-e4lw9x", name: "Poskládat ručníky", min: 5, freq: "denne" }
      ]},
      { id: "room-chodba", name: "Chodba a schody", color: "hall", icon: "i-chodba", tasks: [
        { id: "t18", name: "Zamést nebo vysát", min: 15, freq: "tydne" },
        { id: "t19", name: "Srovnat boty a bundy", min: 5, freq: "denne" },
        { id: "t-7x84be", name: "Vyprat", min: 90, freq: "tydne" },
        { id: "t-po9xgz", name: "Pověsit prádlo", min: 15, freq: "tydne" },
        { id: "t-bqtvkn", name: "Složit prádlo", min: 15, freq: "tydne" }
      ]},
      { id: "room-rn6ka2", name: "Pokojíček", color: "kids", icon: "i-pokojicek", tasks: [
        { id: "t-68e9jb", name: "Vysát", min: 10, freq: "tydne" },
        { id: "t-cn4xa1", name: "Vytřít", min: 10, freq: "tydne" },
        { id: "t-kfe003", name: "Uklidit oblečení", min: 10, freq: "denne" },
        { id: "t-n69ln9", name: "Poskládat věci", min: 20, freq: "tydne" }
      ]},
      { id: "room-auto", name: "Auto", color: "car", icon: "i-car", tasks: [
        { id: "t-auto1", name: "Výměna oleje", min: 60, freq: "rocne" },
        { id: "t-auto2", name: "Vysát a utřít interiér", min: 30, freq: "mesicne" },
        { id: "t-auto3", name: "Výměna pneumatik", min: 60, freq: "pololetne" },
        { id: "t-auto4", name: "Umýt karoserii", min: 30, freq: "ctvrtletne" },
        { id: "t-auto5", name: "Vyklidit odpadky a drobnosti", min: 10, freq: "tydne" }
      ]},
      { id: "room-zahrada", name: "Zahrada", color: "garden", icon: "i-plant", tasks: [
        { id: "t-zah1", name: "Posekat trávník (duben–srpen)", min: 120, freq: "ctrnactidenne" },
        { id: "t-zah2", name: "Zalít záhony a rostliny", min: 20, freq: "denne" },
        { id: "t-zah3", name: "Prořezání keřů a stromů", min: 60, freq: "pololetne" }
      ]}
    ],
    quests: [
      { id: "quest-vanoce", name: "Vánoce", active: false, color: "xmas-green", icon: "i-tree", added: [
        { id: "a1", name: "Naplánovat a koupit dárky", min: 20, freq: "vícekrát" },
        { id: "a2", name: "Napsat a poslat přání", min: 30, freq: "jednorázově" },
        { id: "a3", name: "Ozdobit stromeček a byt", min: 45, freq: "jednorázově" },
        { id: "a4", name: "Upéct cukroví", min: 90, freq: "vícekrát" },
        { id: "a5", name: "Nakoupit na štědrovečerní menu", min: 20, freq: "jednorázově" },
        { id: "a6", name: "Zabalit dárky", min: 60, freq: "jednorázově" }
      ], modified: []},
      { id: "quest-velikonoce", name: "Velikonoce", active: false, color: "easter", icon: "i-egg", added: [
        { id: "a7", name: "Nazdobit vajíčka", min: 60, freq: "jednorázově" },
        { id: "a8", name: "Jarní úklid oken", min: 60, freq: "jednorázově" },
        { id: "a-28t9gr", name: "Nový úkol navíc", min: 30, freq: "denně" },
        { id: "a-0pv89g", name: "Nákup surovin na velikonoční pečení", min: 20, freq: "jednorázově" },
        { id: "a-onmke1", name: "Velikonoční pečení", min: 60, freq: "vícekrát" }
      ], modified: []},
      { id: "quest-beltain", name: "Beltain", active: false, color: "beltain", icon: "i-flower", added: [
        { id: "a9", name: "Vyzdobit domácnost květinami", min: 20, freq: "jednorázově" }
      ], modified: []},
      { id: "quest-halloween", name: "Halloween", active: false, color: "hall-o", icon: "i-ghost", added: [
        { id: "a10", name: "Vydlabat dýni", min: 30, freq: "jednorázově" },
        { id: "a11", name: "Strašidelná výzdoba", min: 20, freq: "jednorázově" }
      ], modified: []},
      { id: "quest-narozeniny", name: "Narozeninová oslava", active: false, color: "bday", icon: "i-balloon", added: [
        { id: "a12", name: "Nákup a příprava občerstvení", min: 60, freq: "jednorázově" },
        { id: "a13", name: "Výzdoba místnosti", min: 30, freq: "jednorázově" }
      ], modified: []}
    ],
    completions: []
  };

  function uid(p) { return p + "-" + Math.random().toString(36).slice(2, 9); }

  function structuredCloneSafe(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // Fills in color/icon on rooms/quests saved before those fields existed, and
  // adds any seed room/quest a returning user's saved state predates (e.g. Auto
  // and Zahrada). Runs on every load so existing phones pick up new content
  // without losing their own edits/completions.
  function migrate(state) {
    var changed = false;
    state.base.forEach(function (r, i) {
      var meta = ROOM_META[r.id];
      if (!r.color) { r.color = meta ? meta.color : FALLBACK_ROOM_COLORS[i % FALLBACK_ROOM_COLORS.length]; changed = true; }
      if (!r.icon) { r.icon = meta ? meta.icon : "i-pokojicek"; changed = true; }
    });
    state.quests.forEach(function (q) {
      var meta = QUEST_META[q.id];
      if (!q.color) { q.color = meta ? meta.color : "petrol"; changed = true; }
      if (!q.icon) { q.icon = meta ? meta.icon : "i-flag"; changed = true; }
    });
    SEED.base.forEach(function (seedRoom) {
      if (!state.base.some(function (r) { return r.id === seedRoom.id; })) {
        state.base.push(structuredCloneSafe(seedRoom));
        changed = true;
      }
    });
    return changed;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return structuredCloneSafe(SEED);
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.base) || !Array.isArray(parsed.quests)) {
        return structuredCloneSafe(SEED);
      }
      if (!Array.isArray(parsed.completions)) parsed.completions = [];
      return parsed;
    } catch (e) {
      console.error("Rozcestník: chyba při čtení localStorage, používám výchozí data.", e);
      return structuredCloneSafe(SEED);
    }
  }

  var state = load();
  var saveTimer = null;
  var listeners = [];

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Rozcestník: uložení se nepovedlo (plné úložiště?).", e);
      notify("save-error");
    }
  }

  if (migrate(state)) persist();

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 300);
  }

  function notify(reason) {
    listeners.forEach(function (fn) {
      try { fn(reason); } catch (e) { console.error(e); }
    });
  }

  var Store = {
    state: state,
    uid: uid,
    onChange: function (fn) { listeners.push(fn); },
    save: function (reason) { scheduleSave(); notify(reason || "change"); },
    saveNow: function (reason) { persist(); notify(reason || "change"); },
    exportJSON: function () {
      return JSON.stringify(state, null, 2);
    },
    importJSON: function (text) {
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: "Soubor není platné JSON." }; }
      if (!parsed || !Array.isArray(parsed.base) || !Array.isArray(parsed.quests)) {
        return { ok: false, error: "Soubor nemá očekávaný tvar (base/quests)." };
      }
      if (!Array.isArray(parsed.completions)) parsed.completions = [];
      state.base = parsed.base;
      state.quests = parsed.quests;
      state.completions = parsed.completions;
      migrate(state);
      persist();
      notify("import");
      return { ok: true };
    }
  };

  window.RozStore = Store;
})();
