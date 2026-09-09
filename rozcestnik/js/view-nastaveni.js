// Settings CRUD editor — writes straight to RozStore (localStorage). Field
// edits update state silently (no re-render, so focus/typing isn't disturbed);
// structural changes (add/delete rooms, tasks, quests) trigger a full render().
(function () {
  "use strict";

  var ic = window.RozIcon;
  var FALLBACK_ROOM_COLORS = ["kitchen", "living", "bedroom", "bath", "hall", "kids", "car", "garden"];

  var FREQ_OPTIONS = [
    ["denne", "denně"], ["tydne", "týdně"], ["ctrnactidenne", "čtrnáctidenně"],
    ["mesicne", "měsíčně"], ["ctvrtletne", "čtvrtletně"], ["pololetne", "pololetně"],
    ["rocne", "ročně"], ["dle_potreby", "dle potřeby"]
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function uid(p) { return window.RozStore.uid(p); }

  function locateBaseTask(id) {
    var state = window.RozStore.state;
    for (var i = 0; i < state.base.length; i++) {
      var r = state.base[i];
      var ti = r.tasks.findIndex(function (t) { return t.id === id; });
      if (ti > -1) return { arr: r.tasks, i: ti };
    }
    return null;
  }
  function locateQuestTask(id) {
    var state = window.RozStore.state;
    for (var j = 0; j < state.quests.length; j++) {
      var q = state.quests[j];
      var ai = q.added.findIndex(function (t) { return t.id === id; });
      if (ai > -1) return { arr: q.added, i: ai };
      var mi = q.modified.findIndex(function (t) { return t.id === id; });
      if (mi > -1) return { arr: q.modified, i: mi };
    }
    return null;
  }
  function locateAnyTask(id) { return locateBaseTask(id) || locateQuestTask(id); }
  function locateRoom(id) {
    var state = window.RozStore.state;
    var i = state.base.findIndex(function (r) { return r.id === id; });
    return i > -1 ? { arr: state.base, i: i } : null;
  }
  function locateQuest(id) {
    var state = window.RozStore.state;
    var i = state.quests.findIndex(function (q) { return q.id === id; });
    return i > -1 ? { arr: state.quests, i: i } : null;
  }
  function allBaseTasksFlat() {
    var out = [];
    window.RozStore.state.base.forEach(function (room) {
      room.tasks.forEach(function (t) { out.push({ id: t.id, label: room.name + " → " + t.name }); });
    });
    return out;
  }

  function baseTaskRowHtml(t) {
    var opts = FREQ_OPTIONS.map(function (o) {
      return '<option value="' + o[0] + '"' + (t.freq === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
    }).join("");
    return '<li class="edit-row" data-id="' + t.id + '">'
      + '<div class="edit-line1">'
        + '<span class="edit-name" contenteditable="true" data-field="name" aria-label="Název úkolu">' + esc(t.name) + "</span>"
        + '<button class="icon-btn" type="button" data-action="delete-base-task" title="Smazat úkol">' + ic("i-x") + "</button>"
      + "</div>"
      + '<div class="edit-line2">'
        + '<input class="edit-min" type="number" min="0" step="5" inputmode="numeric" value="' + (parseInt(t.min, 10) || 0) + '" data-field="min" aria-label="Minuty">'
        + '<span class="unit">min</span>'
        + '<select class="edit-freq" data-field="freq" aria-label="Frekvence">' + opts + "</select>"
      + "</div></li>";
  }

  function questTaskRowHtml(t, withRef) {
    var html = '<li class="edit-row" data-id="' + t.id + '">'
      + '<div class="edit-line1">'
        + '<span class="edit-name" contenteditable="true" data-field="name" aria-label="Název úkolu">' + esc(t.name) + "</span>"
        + '<button class="icon-btn" type="button" data-action="delete-quest-task" title="Smazat úkol">' + ic("i-x") + "</button>"
      + "</div>"
      + '<div class="edit-line2">'
        + '<input class="edit-min" type="number" min="0" step="5" inputmode="numeric" value="' + (parseInt(t.min, 10) || 0) + '" data-field="min" aria-label="Minuty">'
        + '<span class="unit">min</span>'
        + '<input class="edit-freq" type="text" value="' + esc(t.freq || "") + '" data-field="freq" placeholder="jednorázově / vícekrát…" aria-label="Frekvence">'
      + "</div>";
    if (withRef) {
      var allTasks = allBaseTasksFlat();
      var opts = '<option value="">— vyber základní úkol —</option>' + allTasks.map(function (bt) {
        return '<option value="' + bt.id + '"' + (t.baseTaskId === bt.id ? " selected" : "") + ">" + esc(bt.label) + "</option>";
      }).join("");
      html += '<div class="baseref-row"><label>Upravuje:</label><select class="baseref" data-field="baseTaskId" aria-label="Který základní úkol se upravuje">' + opts + "</select></div>";
    }
    html += "</li>";
    return html;
  }

  function roomCardHtml(room) {
    return '<div class="edit-card" data-id="' + room.id + '">'
      + '<div class="card card-head" style="margin-bottom:0">'
        + '<span class="qmedal" style="width:1.9rem;height:1.9rem;background:var(--' + (room.color || "kitchen") + ')">' + ic(room.icon || "i-pokojicek") + "</span>"
        + '<span class="card-title" contenteditable="true" data-field="name" aria-label="Název místnosti">' + esc(room.name) + "</span>"
        + '<button class="icon-btn" type="button" data-action="delete-room" title="Smazat místnost">' + ic("i-x") + "</button>"
      + "</div>"
      + '<ul class="task-list" style="padding:0">' + room.tasks.map(baseTaskRowHtml).join("") + "</ul>"
      + '<button class="add-row" type="button" data-action="add-base-task">+ Přidat úkol</button>'
      + "</div>";
  }

  function questCardHtml(q) {
    return '<div class="edit-card" data-id="' + q.id + '">'
      + '<div class="card card-head" style="margin-bottom:0">'
        + '<span class="qmedal" style="width:1.9rem;height:1.9rem;background:var(--' + (q.color || "petrol") + ')">' + ic(q.icon || "i-flag") + "</span>"
        + '<span class="card-title" contenteditable="true" data-field="name" aria-label="Název questu">' + esc(q.name) + "</span>"
        + '<button class="icon-btn" type="button" data-action="delete-quest" title="Smazat quest">' + ic("i-x") + "</button>"
      + "</div>"
      + '<div class="subhead2">Přidává navíc</div>'
      + '<ul class="task-list" style="padding:0">' + q.added.map(function (t) { return questTaskRowHtml(t, false); }).join("") + "</ul>"
      + '<button class="add-row" type="button" data-action="add-added">+ Přidat úkol navíc</button>'
      + '<div class="subhead2">Upravuje základní úkoly</div>'
      + '<ul class="task-list" style="padding:0">' + q.modified.map(function (t) { return questTaskRowHtml(t, true); }).join("") + "</ul>"
      + '<button class="add-row" type="button" data-action="add-modified">+ Přidat úpravu</button>'
      + "</div>";
  }

  function render() {
    var el = document.getElementById("view-nastaveni");
    var state = window.RozStore.state;
    var totalTasks = state.base.reduce(function (n, r) { return n + r.tasks.length; }, 0);

    el.innerHTML =
      '<p class="eyebrow" style="margin:1.3rem 1.1rem 0">Nastavení</p>'
      + '<h1 class="page-title">Uprav strukturu</h1>'
      + '<p class="lede" style="margin:.3rem 1.1rem 1rem">Klikni na text a přepiš ho, tlačítkem + přidáš řádek nebo celou novou místnost/quest. ' + state.base.length + " místností, " + totalTasks + " úkolů v základu.</p>"
      + '<section class="limb limb-base"><h2>' + ic("i-leaf") + 'Základ <span class="limb-sub">běží pořád</span></h2>'
        + '<div class="cards" id="set-base-cards">' + state.base.map(roomCardHtml).join("") + "</div>"
        + '<button class="add-branch" type="button" data-action="add-room">+ Přidat místnost</button>'
      + "</section>"
      + '<section class="limb limb-quest"><h2>' + ic("i-nav-quest") + 'Questy <span class="limb-sub">volitelné navíc</span></h2>'
        + '<div class="cards" id="set-quest-cards">' + state.quests.map(questCardHtml).join("") + "</div>"
        + '<button class="add-branch" type="button" data-action="add-quest">+ Přidat quest</button>'
      + "</section>"
      + '<div class="settings-footer">'
        + '<button type="button" id="btn-export">' + ic("i-download") + "Zálohovat</button>"
        + '<label style="display:inline-block"><button type="button" id="btn-import-trigger">' + ic("i-upload") + "Obnovit ze zálohy</button><input type=\"file\" id=\"file-import\" accept=\"application/json\"></label>"
      + "</div>";

    wireEvents(el);
  }

  function wireEvents(el) {
    el.addEventListener("click", onClick);
    el.addEventListener("focusout", onFocusOut);
    el.addEventListener("change", onFocusOut);
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.target.matches('[contenteditable="true"]') || e.target.tagName === "INPUT")) {
        e.preventDefault(); e.target.blur();
      }
    });
    document.getElementById("btn-export").addEventListener("click", doExport);
    document.getElementById("btn-import-trigger").addEventListener("click", function () {
      document.getElementById("file-import").click();
    });
    document.getElementById("file-import").addEventListener("change", doImport);
  }

  function onClick(e) {
    var actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    var action = actionEl.dataset.action;
    var rowLi = e.target.closest("li.edit-row[data-id]");
    var card = e.target.closest(".edit-card[data-id]");
    var state = window.RozStore.state;

    if (action === "add-base-task" && card) {
      var room = locateRoom(card.dataset.id);
      if (room) { room.arr[room.i].tasks.push({ id: uid("t"), name: "Nový úkol", min: 10, freq: "tydne" }); window.RozStore.save(); render(); focusNew(); }
    } else if (action === "delete-room" && card) {
      deleteWithUndo(locateRoom(card.dataset.id), "Místnost smazána");
    } else if (action === "add-room") {
      state.base.push({ id: uid("room"), name: "Nová místnost", color: FALLBACK_ROOM_COLORS[state.base.length % FALLBACK_ROOM_COLORS.length], icon: "i-pokojicek", tasks: [] });
      window.RozStore.save(); render(); focusNew();
    } else if (action === "add-quest") {
      state.quests.push({ id: uid("quest"), name: "Nový quest", active: false, color: "petrol", icon: "i-flag", added: [], modified: [] }); window.RozStore.save(); render(); focusNew();
    } else if (action === "delete-quest" && card) {
      deleteWithUndo(locateQuest(card.dataset.id), "Quest smazán");
    } else if (action === "add-added" && card) {
      var qa = locateQuest(card.dataset.id);
      if (qa) { qa.arr[qa.i].added.push({ id: uid("a"), name: "Nový úkol navíc", min: 15, freq: "jednorázově" }); window.RozStore.save(); render(); focusNew(); }
    } else if (action === "add-modified" && card) {
      var qm = locateQuest(card.dataset.id);
      if (qm) { qm.arr[qm.i].modified.push({ id: uid("m"), name: "Upravený úkol", min: 15, freq: "", baseTaskId: "" }); window.RozStore.save(); render(); focusNew(); }
    } else if (action === "delete-base-task" && rowLi) {
      deleteWithUndo(locateBaseTask(rowLi.dataset.id), "Úkol smazán");
    } else if (action === "delete-quest-task" && rowLi) {
      deleteWithUndo(locateQuestTask(rowLi.dataset.id), "Úkol smazán");
    }
  }

  function deleteWithUndo(found, label) {
    if (!found) return;
    var removed = found.arr[found.i], idx = found.i;
    found.arr.splice(idx, 1);
    window.RozStore.save();
    render();
    showToast(label, function () { found.arr.splice(idx, 0, removed); window.RozStore.save(); render(); });
  }

  function onFocusOut(e) {
    var field = e.target && e.target.dataset ? e.target.dataset.field : null;
    if (!field) return;
    var rowLi = e.target.closest("li.edit-row[data-id]");
    var obj = null;
    if (rowLi) {
      var f = locateAnyTask(rowLi.dataset.id);
      if (f) obj = f.arr[f.i];
    } else {
      var card = e.target.closest(".edit-card[data-id]");
      if (card) {
        var room = locateRoom(card.dataset.id);
        var quest = locateQuest(card.dataset.id);
        obj = room ? room.arr[room.i] : (quest ? quest.arr[quest.i] : null);
      }
    }
    if (!obj) return;
    var val = (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") ? e.target.value : e.target.textContent.trim();
    if (field === "min") val = Math.max(0, parseInt(val, 10) || 0);
    obj[field] = val;
    window.RozStore.save();
  }

  function focusNew() {
    requestAnimationFrame(function () {
      var targets = document.querySelectorAll(".card-title, .edit-name");
      var last = targets[targets.length - 1];
      if (last) { last.focus(); var sel = document.getSelection(); if (sel) sel.selectAllChildren(last); }
    });
  }

  function showToast(label, undoFn) {
    var region = document.getElementById("toast-region");
    var t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = "<span>" + esc(label) + '</span><button type="button">Zpět</button>';
    t.querySelector("button").addEventListener("click", function () { undoFn(); t.remove(); });
    region.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 6000);
  }

  function doExport() {
    var blob = new Blob([window.RozStore.exportJSON()], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "rozcestnik-zaloha-" + window.RozDates.todayISO() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function doImport(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var res = window.RozStore.importJSON(String(reader.result));
      if (res.ok) { location.reload(); }
      else { alert("Import se nepovedl: " + res.error); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  window.RozViewNastaveni = { render: render };
})();
