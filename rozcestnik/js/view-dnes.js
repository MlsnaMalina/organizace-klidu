(function () {
  "use strict";

  var D = window.RozDates;
  var TV = window.RozTodayView;
  var DAY_NAMES = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function freqLabel(f) {
    return { denne: "denně", tydne: "týdně", ctvrtletne: "čtvrtletně", dle_potreby: "dle potřeby" }[f] || f || "";
  }

  function rowHtml(t) {
    var metaBits = [];
    if (t.min) metaBits.push('<span class="chip">' + t.min + ' min</span>');
    if (t.room) metaBits.push(esc(t.room));
    if (t.quest) metaBits.push("quest: " + esc(t.quest));
    if (t.baseRef) metaBits.push("míst. " + esc(t.baseRef));
    return '<li class="task-row">'
      + '<button type="button" class="check" role="checkbox" aria-checked="' + (t.done ? "true" : "false") + '" data-kind="' + t.kind + '" data-id="' + t.id + '" aria-label="' + esc(t.name) + '"></button>'
      + '<div class="task-body"><div class="task-name">' + esc(t.name) + '</div>'
      + (metaBits.length ? '<div class="task-meta">' + metaBits.join(" · ") + "</div>" : "")
      + "</div>"
      + (t.kind.indexOf("quest") === 0 ? '<span class="quest-flag" title="Quest úkol">🌊</span>' : "")
      + "</li>";
  }

  function section(title, count, items, emptyText) {
    var html = '<div class="subhead">' + title + (count != null ? ' <span class="count">(' + count + ")</span>" : "") + "</div>";
    if (!items.length) {
      html += '<p class="empty-note">' + emptyText + "</p>";
    } else {
      html += '<ul class="task-list">' + items.map(rowHtml).join("") + "</ul>";
    }
    return html;
  }

  function render() {
    var el = document.getElementById("view-dnes");
    var state = window.RozStore.state;
    var todayISO = D.todayISO();
    var view = TV.computeTodayView(state, todayISO);
    var streak = TV.computeStreak(state, todayISO);
    var pct = view.progressTotal ? Math.round((view.progressDone / view.progressTotal) * 100) : 0;
    var dow = DAY_NAMES[D.toUTCDate(todayISO).getUTCDay()];

    var activeQuestNames = TV.activeQuests(state).map(function (q) { return q.name; });

    el.innerHTML =
      '<p class="eyebrow">' + dow.toUpperCase() + " · " + D.formatCzech(todayISO) + "</p>"
      + '<h1 class="page-title">Ahoj, Katko!</h1>'
      + (activeQuestNames.length
        ? '<p class="lede">Aktivní quest: <strong>' + activeQuestNames.map(esc).join(", ") + "</strong></p>"
        : '<p class="lede">Žádný quest teď není aktivní — jen běžný základ.</p>')
      + '<div class="stat-row">'
        + '<div class="stat-block"><div class="stat-label">Dnešní pokrok</div>'
          + '<div class="stat-value">' + view.progressDone + '<span class="unit">/' + view.progressTotal + "</span></div>"
          + '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>'
        + "</div>"
        + '<div class="stat-block"><div class="stat-label">Řada dní</div>'
          + '<div class="stat-value">' + streak + '<span class="unit"> ' + (streak === 1 ? "den" : (streak >= 2 && streak <= 4 ? "dny" : "dní")) + "</span></div>"
        + "</div>"
      + "</div>"
      + section("Dnes", view.daily.length, view.daily, "Na dnešek nic denního nezbývá.")
      + (view.questAdded.length ? section("Quest úkoly", view.questAdded.length, view.questAdded, "") : "")
      + section("Tento týden ještě zbývá", view.weekly.length, view.weekly, "Týdenní úkoly máš tento týden hotové. 🎉")
      + section("Tento kvartál ještě zbývá", view.quarterly.length, view.quarterly, "Čtvrtletní úkoly máš zatím hotové.")
      + section("Dle potřeby", null, view.asNeeded, "Nic v této kategorii.");

    el.querySelectorAll(".check").forEach(function (btn) {
      btn.addEventListener("click", function () {
        toggle(btn.dataset.kind, btn.dataset.id);
      });
    });
  }

  function toggle(kind, taskId) {
    var state = window.RozStore.state;
    var todayISO = D.todayISO();
    var idx = state.completions.findIndex(function (c) { return c.kind === kind && c.taskId === taskId && c.date === todayISO; });
    if (idx > -1) state.completions.splice(idx, 1);
    else state.completions.push({ id: window.RozStore.uid("c"), kind: kind, taskId: taskId, date: todayISO });
    window.RozStore.save("toggle");
    render();
  }

  window.RozViewDnes = { render: render };
})();
