(function () {
  "use strict";

  var D = window.RozDates;
  var TV = window.RozTodayView;
  var DAY_NAMES = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];

  var selectedRoomId = null; // resets to the day's suggested room each fresh load
  var timer = { running: false, remainingSec: 0, roomId: null, intervalId: null };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function mmss(totalSec) { return pad2(Math.floor(totalSec / 60)) + ":" + pad2(totalSec % 60); }

  function starsRow(streak) {
    var svg = '<svg viewBox="0 0 24 24" fill="var(--raspberry)" stroke="none"><path d="M12 2l2.4 6.6H21l-5.4 4 2 6.6L12 15.6 6.4 19.2l2-6.6L3 8.6h6.6z"/></svg>';
    var n = Math.min(5, Math.max(streak, streak === 0 ? 0 : 1));
    var stars = "";
    for (var i = 0; i < 5; i++) stars += i < n ? svg : svg.replace('fill="var(--raspberry)"', 'fill="var(--line)"');
    return '<div class="stars-row">' + stars + '<span class="streak-num">' + streak + (streak === 1 ? " den v řadě" : (streak >= 2 && streak <= 4 ? " dny v řadě" : " dní v řadě")) + '</span></div>';
  }

  function roomChipHtml(room, suggestedId) {
    var key = TV.roomColorKey(window.RozStore.state, room.id);
    var isActive = room.id === selectedRoomId;
    var isSuggested = room.id === suggestedId;
    return '<button type="button" class="room-chip' + (isActive ? " active" : "") + (isSuggested ? " suggested" : "") + '" style="--chip-color:var(--room-' + key + ');--chip-soft:var(--room-' + key + '-soft)" data-room-id="' + room.id + '">'
      + '<span class="dot" style="background:var(--room-' + key + ')"></span>' + esc(room.name)
      + "</button>";
  }

  function stopHtml(t, idx) {
    var side = idx % 2 === 1 ? " right" : "";
    var isQuest = t.kind.indexOf("quest") === 0;
    var cls = "stop" + (isQuest ? " quest" : "") + side + (t.done ? " done" : "");
    var color = isQuest ? "var(--pine)" : ("var(--room-" + (t.colorKey || "a") + ")");
    var sub = isQuest ? ("Quest · " + esc(t.quest)) : esc(t.room || "");
    return '<div class="' + cls + '">'
      + '<button type="button" class="node' + (t.done ? " done" : "") + '" style="background:' + color + '" data-kind="' + t.kind + '" data-id="' + t.id + '" aria-label="' + esc(t.name) + (t.done ? " (hotovo)" : "") + '">'
        + (isQuest ? '<span class="flag">🚩</span>' : "")
      + "</button>"
      + '<div class="stop-label"><b>' + esc(t.name) + "</b><span>" + sub + "</span></div>"
      + '<div class="stop-time" style="background:' + color + '">' + (t.min || 0) + " min</div>"
      + "</div>";
  }

  function pathHtml(items) {
    if (!items.length) return '<p class="empty-note">Pro dnešek nic nezbývá. 🎉</p>';
    return '<div class="path">' + items.map(stopHtml).join("") + "</div>";
  }

  function simpleListHtml(items) {
    if (!items.length) return '<p class="empty-note">Nic v této kategorii.</p>';
    return '<ul class="task-list">' + items.map(function (t) {
      return '<li class="task-row"><button type="button" class="check" role="checkbox" aria-checked="' + (t.done ? "true" : "false") + '" data-kind="' + t.kind + '" data-id="' + t.id + '" aria-label="' + esc(t.name) + '"></button>'
        + '<div class="task-body"><div class="task-name">' + esc(t.name) + '</div><div class="task-meta">' + (t.min || 0) + " min" + (t.room ? " · " + esc(t.room) : "") + "</div></div></li>";
    }).join("") + "</ul>";
  }

  function timerBarHtml(room, sessionMinutes) {
    if (!room) return "";
    var isThisRoom = timer.roomId === room.id;
    var running = isThisRoom && timer.running;
    var display = running ? mmss(timer.remainingSec) : mmss(Math.max(sessionMinutes, 0) * 60);
    var sub = sessionMinutes > 0 ? (sessionMinutes + " min v zásobníku pro tuto místnost") : "zásobník téhle místnosti je prázdný";
    return '<div class="timer-bar' + (isThisRoom && timer.remainingSec === 0 && timer.roomId ? " done" : "") + '" id="timer-bar">'
      + '<div class="timer-info"><div class="timer-room">' + esc(room.name) + '</div><div class="timer-sub">' + sub + "</div></div>"
      + '<div class="timer-display" id="timer-display">' + display + "</div>"
      + '<button type="button" class="timer-btn' + (running ? " stop" : "") + '" id="timer-toggle" ' + (sessionMinutes <= 0 && !running ? "disabled" : "") + ">" + (running ? "Zastavit" : "Spustit odpočet") + "</button>"
      + "</div>";
  }

  function render() {
    var el = document.getElementById("view-dnes");
    var state = window.RozStore.state;
    var todayISO = D.todayISO();
    var suggested = TV.roomOfToday(state, todayISO);
    if (selectedRoomId === null) selectedRoomId = suggested ? suggested.id : null;
    if (selectedRoomId && !state.base.some(function (r) { return r.id === selectedRoomId; })) selectedRoomId = suggested ? suggested.id : null;
    var selectedRoom = state.base.find(function (r) { return r.id === selectedRoomId; }) || null;

    var view = TV.computeTodayView(state, todayISO, selectedRoomId);
    var streak = TV.computeStreak(state, todayISO);
    var pct = view.progressTotal ? Math.round((view.progressDone / view.progressTotal) * 100) : 0;
    var dow = DAY_NAMES[D.toUTCDate(todayISO).getUTCDay()];
    var activeQuestList = TV.activeQuests(state);

    var pathItems = view.daily.concat(view.weekly, view.quarterly, view.questAdded, view.questModified);

    el.innerHTML =
      '<header class="top-block"><div class="blob"></div><div class="blob2"></div><div class="inner">'
        + '<p class="eyebrow">' + dow.toUpperCase() + " · " + D.formatCzech(todayISO) + "</p>"
        + '<h1 class="page-title">Ahoj, Katko!</h1>'
        + starsRow(streak)
        + '<div class="progress-mini"><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div><div class="progress-num">' + view.progressDone + "/" + view.progressTotal + "</div></div>"
      + "</div>"
      + (activeQuestList.length
        ? activeQuestList.map(function (q) {
            return '<div class="badge-quest"><div class="icon">🎄</div><div><b>' + esc(q.name) + ' aktivní</b><span>Přidává úkoly do dnešní trasy</span></div></div>';
          }).join("")
        : "")
      + "</header>"
      + '<div class="room-picker">' + state.base.map(function (r) { return roomChipHtml(r, suggested ? suggested.id : null); }).join("") + "</div>"
      + timerBarHtml(selectedRoom, view.sessionMinutes)
      + '<h2 class="section-title">Dnešní trasa</h2>'
      + '<p class="lede">Projdi si zastávky jednu po druhé.</p>'
      + pathHtml(pathItems)
      + '<div class="subhead">Dle potřeby</div>'
      + simpleListHtml(view.asNeeded);

    wireEvents(el, selectedRoom, view.sessionMinutes);
  }

  function wireEvents(el, selectedRoom) {
    el.querySelectorAll(".node, .check").forEach(function (btn) {
      btn.addEventListener("click", function () { toggle(btn.dataset.kind, btn.dataset.id); });
    });
    el.querySelectorAll(".room-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        selectedRoomId = chip.dataset.roomId;
        stopTimer();
        render();
      });
    });
    var toggleBtn = document.getElementById("timer-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        if (timer.running && timer.roomId === (selectedRoom && selectedRoom.id)) stopTimer();
        else startTimer(selectedRoom);
        renderTimerOnly();
      });
    }
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

  function startTimer(room) {
    if (!room) return;
    clearInterval(timer.intervalId);
    var state = window.RozStore.state;
    var view = TV.computeTodayView(state, D.todayISO(), room.id);
    timer.remainingSec = Math.max(view.sessionMinutes, 1) * 60;
    timer.running = true;
    timer.roomId = room.id;
    timer.intervalId = setInterval(function () {
      timer.remainingSec--;
      if (timer.remainingSec <= 0) { timer.remainingSec = 0; timer.running = false; clearInterval(timer.intervalId); }
      renderTimerOnly();
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timer.intervalId);
    timer.running = false;
  }

  function renderTimerOnly() {
    var bar = document.getElementById("timer-bar");
    var display = document.getElementById("timer-display");
    var btn = document.getElementById("timer-toggle");
    if (!bar || !display || !btn) return;
    display.textContent = timer.running ? mmss(timer.remainingSec) : display.textContent;
    if (timer.running) {
      btn.textContent = "Zastavit";
      btn.classList.add("stop");
    } else {
      btn.textContent = "Spustit odpočet";
      btn.classList.remove("stop");
      if (timer.remainingSec === 0 && timer.roomId) { bar.classList.add("done"); display.textContent = "00:00"; }
    }
  }

  window.RozViewDnes = { render: render };
})();
