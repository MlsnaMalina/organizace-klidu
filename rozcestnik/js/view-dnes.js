(function () {
  "use strict";

  var D = window.RozDates;
  var TV = window.RozTodayView;
  var DAY_NAMES = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];

  var mode = "grid"; // 'grid' | 'room' | 'quest'
  var openId = null;
  var timer = { running: false, scopeType: null, scopeId: null, elapsedSec: 0, lastCheckpointSec: 0, intervalId: null };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function mmss(totalSec) { return pad2(Math.floor(totalSec / 60)) + ":" + pad2(totalSec % 60); }
  function actualLabelText(mins) { return mins === 0 ? "< 1 min" : mins + " min"; }

  function starsRow(streak) {
    var svgOn = '<svg viewBox="0 0 24 24" fill="var(--raspberry)" stroke="none"><path d="M12 2l2.4 6.6H21l-5.4 4 2 6.6L12 15.6 6.4 19.2l2-6.6L3 8.6h6.6z"/></svg>';
    var svgOff = svgOn.replace('fill="var(--raspberry)"', 'fill="var(--line)"');
    var n = Math.min(5, streak);
    var stars = "";
    for (var i = 0; i < 5; i++) stars += i < n ? svgOn : svgOff;
    return '<div class="stars-row">' + stars + '<span class="streak-num">' + streak + (streak === 1 ? " den v řadě" : (streak >= 2 && streak <= 4 ? " dny v řadě" : " dní v řadě")) + '</span></div>';
  }

  function roomCardHtml(state, room, todayISO, suggestedId) {
    var key = TV.roomColorKey(state, room.id);
    var sum = TV.roomSummary(state, room.id, todayISO);
    var isSuggested = room.id === suggestedId;
    return '<button type="button" class="room-card" style="--tile:var(--room-' + key + ');--tile-soft:var(--room-' + key + '-soft)" data-open-room="' + room.id + '">'
      + '<div class="rc-icon">🏠</div>'
      + '<div class="rc-name">' + esc(room.name) + (isSuggested ? ' <span title="Doporučeno na dnes">✨</span>' : "") + "</div>"
      + '<div class="rc-stat">' + (sum.remaining ? sum.remaining + "× úkol · ~" + sum.minutes + " min" : "vše hotovo 🎉") + "</div>"
      + "</button>";
  }

  function questCardHtml(state, q, todayISO) {
    var sum = TV.questSummary(state, q, todayISO);
    return '<button type="button" class="room-card quest-tile" data-open-quest="' + q.id + '">'
      + '<div class="rc-icon">🚩</div>'
      + '<div class="rc-name">' + esc(q.name) + "</div>"
      + '<div class="rc-stat">' + (sum.remaining ? sum.remaining + "× quest úkol" : "vše hotovo 🎉") + "</div>"
      + "</button>";
  }

  function stopHtml(t, idx) {
    var side = idx % 2 === 1 ? " right" : "";
    var isQuest = !!t.isQuest;
    var cls = "stop" + (isQuest ? " quest" : "") + side + (t.done ? " done" : "");
    var color = isQuest && !t.colorKey ? "var(--petrol)" : ("var(--room-" + (t.colorKey || "a") + ")");
    var sub = isQuest ? ("Quest · " + esc(t.quest)) : "";
    return '<div class="' + cls + '">'
      + '<button type="button" class="node' + (t.done ? " done" : "") + '" style="background:' + color + '" data-kind="' + t.kind + '" data-id="' + t.id + '" aria-label="' + esc(t.name) + (t.done ? " (hotovo)" : "") + '">'
        + (isQuest ? '<span class="flag">🚩</span>' : "")
      + "</button>"
      + '<div class="stop-label"><b>' + esc(t.name) + "</b>" + (sub ? "<span>" + sub + "</span>" : "") + "</div>"
      + '<div class="stop-time" style="background:' + color + '">' + (t.min || 0) + " min"
        + (t.done && t.actual != null ? '<span class="stop-actual">✓ ' + actualLabelText(t.actual) + "</span>" : "")
      + "</div>"
      + "</div>";
  }

  function pathHtml(items) {
    if (!items.length) return '<p class="empty-note">Tady teď nic nezbývá. 🎉</p>';
    return '<div class="path">' + items.map(stopHtml).join("") + "</div>";
  }

  function timerBarHtml(scopeType, scopeId, label) {
    var isThis = timer.scopeType === scopeType && timer.scopeId === scopeId;
    var running = isThis && timer.running;
    var display = isThis ? mmss(timer.elapsedSec) : "00:00";
    return '<div class="timer-bar" id="timer-bar">'
      + '<div class="timer-info"><div class="timer-room">' + esc(label) + '</div><div class="timer-sub">' + (running ? "odpočet běží" : "změř si reálný čas úklidu") + "</div></div>"
      + '<div class="timer-display" id="timer-display">' + display + "</div>"
      + '<button type="button" class="timer-btn' + (running ? " stop" : "") + '" id="timer-toggle">' + (running ? "Zastavit" : "Spustit odpočet") + "</button>"
      + "</div>";
  }

  function renderGrid(state, todayISO) {
    var streak = TV.computeStreak(state, todayISO);
    var overall = TV.overallProgress(state, todayISO);
    var pct = overall.total ? Math.round((overall.done / overall.total) * 100) : 0;
    var dow = DAY_NAMES[D.toUTCDate(todayISO).getUTCDay()];
    var suggested = TV.roomOfToday(state, todayISO);
    var activeQuestList = TV.activeQuests(state);

    return '<header class="top-block"><div class="blob"></div><div class="blob2"></div><div class="inner">'
      + '<p class="eyebrow">' + dow.toUpperCase() + " · " + D.formatCzech(todayISO) + "</p>"
      + '<h1 class="page-title">Ahoj, Katko!</h1>'
      + starsRow(streak)
      + '<div class="progress-mini"><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div><div class="progress-num">' + overall.done + "/" + overall.total + "</div></div>"
      + "</div></header>"
      + '<div class="card-grid">'
        + state.base.map(function (r) { return roomCardHtml(state, r, todayISO, suggested ? suggested.id : null); }).join("")
        + activeQuestList.map(function (q) { return questCardHtml(state, q, todayISO); }).join("")
      + "</div>"
      + '<div class="subhead">Dle potřeby</div>'
      + simpleListHtml(TV.asNeededTasks(state, todayISO));
  }

  function simpleListHtml(items) {
    if (!items.length) return '<p class="empty-note">Nic v této kategorii.</p>';
    return '<ul class="task-list">' + items.map(function (t) {
      return '<li class="task-row"><button type="button" class="check" role="checkbox" aria-checked="' + (t.done ? "true" : "false") + '" data-kind="' + t.kind + '" data-id="' + t.id + '" aria-label="' + esc(t.name) + '"></button>'
        + '<div class="task-body"><div class="task-name">' + esc(t.name) + '</div><div class="task-meta">' + (t.min || 0) + " min" + (t.room ? " · " + esc(t.room) : "") + "</div></div></li>";
    }).join("") + "</ul>";
  }

  function renderRoomDetail(state, todayISO, roomId) {
    var room = state.base.find(function (r) { return r.id === roomId; });
    if (!room) { mode = "grid"; return renderGrid(state, todayISO); }
    var tasks = TV.roomDetailTasks(state, roomId, todayISO);
    return '<div class="detail-head"><button type="button" class="back-btn" id="back-btn" aria-label="Zpět">←</button><h1>' + esc(room.name) + "</h1></div>"
      + timerBarHtml("room", roomId, room.name)
      + '<h2 class="section-title">Dnešní trasa</h2>'
      + '<p class="lede">Projdi si zastávky jednu po druhé.</p>'
      + pathHtml(tasks);
  }

  function renderQuestDetail(state, todayISO, questId) {
    var q = state.quests.find(function (x) { return x.id === questId; });
    if (!q) { mode = "grid"; return renderGrid(state, todayISO); }
    var tasks = TV.questDetailTasks(state, q, todayISO);
    return '<div class="detail-head"><button type="button" class="back-btn" id="back-btn" aria-label="Zpět">←</button><h1 style="color:var(--petrol)">' + esc(q.name) + "</h1></div>"
      + timerBarHtml("quest", questId, q.name)
      + '<h2 class="section-title">Questové úkoly</h2>'
      + pathHtml(tasks);
  }

  function render() {
    var el = document.getElementById("view-dnes");
    var state = window.RozStore.state;
    var todayISO = D.todayISO();
    if (mode === "room") el.innerHTML = renderRoomDetail(state, todayISO, openId);
    else if (mode === "quest") el.innerHTML = renderQuestDetail(state, todayISO, openId);
    else el.innerHTML = renderGrid(state, todayISO);
    wireEvents(el);
  }

  function wireEvents(el) {
    el.querySelectorAll(".node, .check").forEach(function (btn) {
      btn.addEventListener("click", function () { toggle(btn.dataset.kind, btn.dataset.id); });
    });
    el.querySelectorAll("[data-open-room]").forEach(function (b) {
      b.addEventListener("click", function () { mode = "room"; openId = b.dataset.openRoom; render(); });
    });
    el.querySelectorAll("[data-open-quest]").forEach(function (b) {
      b.addEventListener("click", function () { mode = "quest"; openId = b.dataset.openQuest; render(); });
    });
    var back = document.getElementById("back-btn");
    if (back) back.addEventListener("click", function () { mode = "grid"; openId = null; stopTimer(); render(); });
    var toggleBtn = document.getElementById("timer-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        var scopeType = mode === "quest" ? "quest" : "room";
        if (timer.running && timer.scopeType === scopeType && timer.scopeId === openId) stopTimer();
        else startTimer(scopeType, openId);
        renderTimerOnly();
      });
    }
  }

  function toggle(kind, taskId) {
    var state = window.RozStore.state;
    var todayISO = D.todayISO();
    var idx = state.completions.findIndex(function (c) { return c.kind === kind && c.taskId === taskId && c.date === todayISO; });
    if (idx > -1) {
      state.completions.splice(idx, 1);
    } else {
      var rec = { id: window.RozStore.uid("c"), kind: kind, taskId: taskId, date: todayISO, actualMin: null };
      var scopeType = mode === "quest" ? "quest" : (mode === "room" ? "room" : null);
      if (timer.running && scopeType && timer.scopeType === scopeType && timer.scopeId === openId) {
        rec.actualMin = Math.round((timer.elapsedSec - timer.lastCheckpointSec) / 60);
        timer.lastCheckpointSec = timer.elapsedSec;
      }
      state.completions.push(rec);
    }
    window.RozStore.save("toggle");
    render();
  }

  function startTimer(scopeType, scopeId) {
    clearInterval(timer.intervalId);
    timer.running = true; timer.scopeType = scopeType; timer.scopeId = scopeId;
    timer.elapsedSec = 0; timer.lastCheckpointSec = 0;
    timer.intervalId = setInterval(function () { timer.elapsedSec++; renderTimerOnly(); }, 1000);
  }
  function stopTimer() {
    clearInterval(timer.intervalId);
    timer.running = false;
  }
  function renderTimerOnly() {
    var display = document.getElementById("timer-display");
    var btn = document.getElementById("timer-toggle");
    var sub = document.querySelector(".timer-sub");
    if (!display || !btn) return;
    display.textContent = mmss(timer.elapsedSec);
    btn.textContent = timer.running ? "Zastavit" : "Spustit odpočet";
    btn.classList.toggle("stop", timer.running);
    if (sub) sub.textContent = timer.running ? "odpočet běží" : "změř si reálný čas úklidu";
  }

  window.RozViewDnes = { render: render };
})();
