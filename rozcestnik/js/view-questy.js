(function () {
  "use strict";

  var expanded = {};

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function previewList(q) {
    var items = (q.added || []).map(function (t) { return esc(t.name); })
      .concat((q.modified || []).map(function (t) { return esc(t.name) + " (úprava)"; }));
    if (!items.length) return '<p class="empty-note">Zatím žádné úkoly — doplň je v Nastavení.</p>';
    return '<ul class="task-list">' + items.map(function (n) {
      return '<li class="task-row"><div class="task-body"><div class="task-name">' + n + "</div></div></li>";
    }).join("") + "</ul>";
  }

  function cardHtml(q) {
    var isOpen = !!expanded[q.id];
    var count = (q.added || []).length + (q.modified || []).length;
    return '<div class="card" data-id="' + q.id + '">'
      + '<div class="quest-card-head">'
        + '<button type="button" class="switch" role="switch" aria-checked="' + (q.active ? "true" : "false") + '" data-action="toggle-active" aria-label="Aktivovat quest ' + esc(q.name) + '"></button>'
        + '<div style="flex:1">'
          + '<span class="card-title" data-action="toggle-expand" style="cursor:pointer">' + esc(q.name) + "</span>"
          + '<div class="quest-sub-count">' + count + (count === 1 ? " úkol" : (count >= 2 && count <= 4 ? " úkoly" : " úkolů")) + (q.active ? " · aktivní" : "") + "</div>"
        + "</div>"
      + "</div>"
      + (isOpen ? previewList(q) : "")
      + "</div>";
  }

  function render() {
    var el = document.getElementById("view-questy");
    var state = window.RozStore.state;
    el.innerHTML =
      '<p class="eyebrow">Volitelná vrstva</p>'
      + '<h1 class="page-title">Questy</h1>'
      + '<p class="lede">Zapni quest, když se blíží jeho akce — přidá své úkoly k dnešnímu přehledu. Obsah questů uprav v Nastavení.</p>'
      + state.quests.map(cardHtml).join("");

    el.querySelectorAll('[data-action="toggle-active"]').forEach(function (btn) {
      btn.addEventListener("click", function () {
        var card = btn.closest(".card");
        var q = state.quests.find(function (x) { return x.id === card.dataset.id; });
        if (q) { q.active = !q.active; window.RozStore.save("quest-toggle"); render(); }
      });
    });
    el.querySelectorAll('[data-action="toggle-expand"]').forEach(function (el2) {
      el2.addEventListener("click", function () {
        var card = el2.closest(".card");
        expanded[card.dataset.id] = !expanded[card.dataset.id];
        render();
      });
    });
  }

  window.RozViewQuesty = { render: render };
})();
