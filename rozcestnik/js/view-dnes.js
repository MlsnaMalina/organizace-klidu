(function () {
  "use strict";

  var D = window.RozDates;
  var TV = window.RozTodayView;
  var ic = window.RozIcon;
  var DAY_NAMES = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];

  var mode = "grid"; // 'grid' | 'room' | 'quest'
  var openId = null;
  var selectedDeckIdx = null; // sticks across re-renders of the grid within one visit

  // Per-task stopwatches. Ephemeral (not persisted) — a reload starts fresh,
  // same as the app's previous single-timer behavior. Key: "kind:taskId".
  var timers = {};
  var tickInterval = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function mmss(totalSec) { return pad2(Math.floor(totalSec / 60)) + ":" + pad2(totalSec % 60); }
  function timerKey(kind, id) { return kind + ":" + id; }

  function starsRow(streak) {
    var starPath = "M12 2l2.4 6.6H21l-5.4 4 2 6.6L12 15.6 6.4 19.2l2-6.6L3 8.6h6.6z";
    var n = Math.min(5, streak);
    var stars = "";
    for (var i = 0; i < 5; i++) {
      stars += '<svg viewBox="0 0 24 24" fill="' + (i < n ? "#fff" : "rgba(255,255,255,.35)") + '" stroke="none"><path d="' + starPath + '"/></svg>';
    }
    return '<div class="stars-row">' + stars + '<span class="streak-num">' + streak + (streak === 1 ? " den v řadě" : (streak >= 2 && streak <= 4 ? " dny v řadě" : " dní v řadě")) + '</span></div>';
  }

  function deckItems(state) {
    var items = state.base.map(function (r) {
      var sum = TV.roomSummary(state, r.id, D.todayISO());
      return { kind: "room", id: r.id, name: r.name, icon: r.icon, colorVar: r.color, stat: sum.remaining ? sum.remaining + "× úkol · ~" + sum.minutes + " min" : "vše hotovo", ink: r.color === "kitchen" ? "var(--kitchen-ink)" : "#fff" };
    });
    TV.activeQuests(state).forEach(function (q) {
      var sum = TV.questSummary(state, q, D.todayISO());
      items.push({ kind: "quest", id: q.id, name: q.name, icon: q.icon || "i-flag", colorVar: q.color || "petrol", stat: sum.remaining ? sum.remaining + "× quest úkol" : "vše hotovo", ink: "#fff" });
    });
    return items;
  }

  function deckCardHtml(item, isToday) {
    return '<div class="pcard" data-kind="' + item.kind + '" data-id="' + item.id + '" style="--rc:var(--' + item.colorVar + ');--rc-soft:var(--' + item.colorVar + '-soft);--rc-ink:' + item.ink + '">'
      + (isToday ? '<div class="todaydot"></div>' : "")
      + '<div class="mini">' + ic(item.icon) + "</div>"
      + '<div class="full">'
        + (isToday ? '<div class="todaypill">DNES</div>' : "")
        + '<div class="medal" style="color:' + item.ink + '">' + ic(item.icon) + "</div>"
        + '<div class="pname">' + esc(item.name) + "</div>"
        + '<div class="prule"></div>'
        + '<div class="pstat">' + esc(item.stat) + "</div>"
      + "</div>"
    + "</div>";
  }

  function renderGrid(state, todayISO) {
    var streak = TV.computeStreak(state, todayISO);
    var overall = TV.overallProgress(state, todayISO);
    var pct = overall.total ? Math.round((overall.done / overall.total) * 100) : 0;
    var dow = DAY_NAMES[D.toUTCDate(todayISO).getUTCDay()];
    var circumference = 2 * Math.PI * 24;
    var offset = circumference * (1 - pct / 100);
    var suggested = TV.roomOfToday(state, todayISO);
    var items = deckItems(state);
    var todayIdx = suggested ? items.findIndex(function (it) { return it.kind === "room" && it.id === suggested.id; }) : -1;
    if (selectedDeckIdx == null || selectedDeckIdx >= items.length) selectedDeckIdx = todayIdx > -1 ? todayIdx : 0;

    return '<div class="hdwrap"><header class="tear-hd">'
        + '<p class="eyebrow">' + dow.toUpperCase() + " · " + D.formatCzech(todayISO) + "</p>"
        + '<h1 class="page-title" style="margin:.15rem 0 .7rem;padding:0">Ahoj, Katko!</h1>'
        + starsRow(streak)
      + "</header>"
      + '<div class="hero-ring"><svg width="64" height="64" viewBox="0 0 58 58"><circle cx="29" cy="29" r="24" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="29" cy="29" r="24" fill="none" stroke="var(--petrol)" stroke-width="6" stroke-dasharray="' + circumference.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" stroke-linecap="round" transform="rotate(-90 29 29)"/></svg><b>' + pct + "%</b></div>"
    + "</div>"
    + '<div class="deck-wrap">'
      + '<div class="subhead" style="margin-top:0">Celá paluba — klepni, vlna se přelije</div>'
      + '<div class="deck" id="deck">' + items.map(function (it, i) { return deckCardHtml(it, i === todayIdx); }).join("") + "</div>"
    + "</div>"
    + '<div class="subhead">Dle potřeby</div>'
    + simpleListHtml(TV.asNeededTasks(state, todayISO));
  }

  function simpleListHtml(items) {
    if (!items.length) return '<p class="empty-note">Nic v této kategorii.</p>';
    return '<ul class="task-list">' + items.map(function (t) {
      return '<li class="task-row"><button type="button" class="check" role="checkbox" aria-checked="' + (t.done ? "true" : "false") + '" data-kind="' + t.kind + '" data-id="' + t.id + '" aria-label="' + esc(t.name) + '">' + ic("i-check") + '</button>'
        + '<div class="task-body"><div class="task-name">' + esc(t.name) + '</div><div class="task-meta">' + (t.min || 0) + " min" + (t.room ? " · " + esc(t.room) : "") + "</div></div></li>";
    }).join("") + "</ul>";
  }

  function stopHtml(t, idx) {
    var side = idx % 2 === 1 ? " right" : "";
    var key = timerKey(t.kind, t.id);
    var timer = timers[key];
    var running = !!(timer && timer.running);
    var colorVar = t.isQuest && !t.colorKey ? "petrol" : (t.colorKey || "kitchen");
    var iconId = t.done ? "i-check" : (running ? "i-pause" : "i-play");
    var timeInfo = t.min + " min odhad";
    if (running) timeInfo = '<span class="live" data-timer-live="' + esc(key) + '">' + mmss(timer.elapsedSec) + "</span>";
    else if (t.done && t.actual != null) timeInfo = '<span class="actual">✓ ' + (t.actual === 0 ? "< 1 min" : t.actual + " min") + "</span>";
    return '<div class="stop' + side + (t.done ? " done" : "") + '" data-id="' + t.id + '" data-kind="' + t.kind + '">'
      + '<button type="button" class="draghandle" aria-label="Přeskládat" data-drag-id="' + t.id + '">' + ic("i-drag") + "</button>"
      + '<button type="button" class="node' + (t.done ? " done" : "") + '" style="--rc:var(--' + colorVar + ');--rc-soft:var(--' + colorVar + '-soft)" data-node-kind="' + t.kind + '" data-node-id="' + t.id + '" aria-label="' + esc(t.name) + (t.done ? " (hotovo)" : "") + '">' + ic(iconId) + "</button>"
      + '<div class="stop-label"><b>' + esc(t.name) + "</b>" + (t.isQuest ? '<span class="sub">Quest · ' + esc(t.quest) + "</span>" : "") + '<div class="stop-time">' + timeInfo + "</div></div>"
    + "</div>";
  }

  function pathHtml(items) {
    if (!items.length) return '<p class="empty-note">Tady teď nic nezbývá.</p>';
    // The trail's <path> is empty here on purpose — .node positions depend on
    // real text wrapping, which we can't know until the browser has laid the
    // stops out. drawTrail() measures the actual rendered nodes and fills the
    // curve in afterwards, so it always matches where the stops really are.
    return '<div class="path"><svg class="trail" preserveAspectRatio="none"><path stroke="var(--petrol)" stroke-width="5" stroke-dasharray="3 11" fill="none" stroke-linecap="round" opacity="0.85"/></svg>'
      + items.map(stopHtml).join("") + "</div>";
  }

  // Draws the curved connector through the *actual* rendered node centers
  // (not guessed coordinates) — task names wrap to different numbers of
  // lines, so stop heights vary and can't be predicted before layout.
  function drawTrail(pathEl) {
    if (!pathEl) return;
    var svg = pathEl.querySelector("svg.trail");
    var pathTag = svg && svg.querySelector("path");
    var nodes = pathEl.querySelectorAll(".node");
    if (!svg || !pathTag || !nodes.length) return;
    var box = pathEl.getBoundingClientRect();
    var w = Math.max(1, box.width), h = Math.max(1, box.height);
    svg.setAttribute("viewBox", "0 0 " + w.toFixed(1) + " " + h.toFixed(1));
    var pts = Array.prototype.map.call(nodes, function (n) {
      var r = n.getBoundingClientRect();
      return [(r.left + r.width / 2 - box.left).toFixed(1), (r.top + r.height / 2 - box.top).toFixed(1)];
    });
    var d = "M" + pts[0][0] + " " + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var prevMidY = ((+pts[i - 1][1] + +pts[i][1]) / 2).toFixed(1);
      d += " S " + pts[i - 1][0] + " " + prevMidY + "," + pts[i][0] + " " + pts[i][1];
    }
    pathTag.setAttribute("d", d);
  }

  function renderRoomDetail(state, todayISO, roomId) {
    var room = state.base.find(function (r) { return r.id === roomId; });
    if (!room) { mode = "grid"; return renderGrid(state, todayISO); }
    var tasks = TV.roomDetailTasks(state, roomId, todayISO);
    return '<div class="detail-hd" style="--rc:var(--' + room.color + ')">'
        + '<button type="button" class="back-btn" id="back-btn" aria-label="Zpět">' + ic("i-back") + "</button>"
        + "<h1>" + ic(room.icon) + esc(room.name) + "</h1>"
        + '<div class="roomstat">' + tasks.length + (tasks.length === 1 ? " úkol na dnešní cestě" : " úkoly na dnešní cestě") + "</div>"
      + "</div>"
      + pathHtml(tasks);
  }

  function renderQuestDetail(state, todayISO, questId) {
    var q = state.quests.find(function (x) { return x.id === questId; });
    if (!q) { mode = "grid"; return renderGrid(state, todayISO); }
    var tasks = TV.questDetailTasks(state, q, todayISO);
    return '<div class="detail-hd" style="--rc:var(--' + (q.color || "petrol") + ')">'
        + '<button type="button" class="back-btn" id="back-btn" aria-label="Zpět">' + ic("i-back") + "</button>"
        + "<h1>" + ic(q.icon || "i-flag") + esc(q.name) + "</h1>"
        + '<div class="roomstat">' + tasks.length + (tasks.length === 1 ? " questový úkol" : " questové úkoly") + "</div>"
      + "</div>"
      + pathHtml(tasks);
  }

  function render() {
    var el = document.getElementById("view-dnes");
    var state = window.RozStore.state;
    var todayISO = D.todayISO();
    if (mode === "room") el.innerHTML = renderRoomDetail(state, todayISO, openId);
    else if (mode === "quest") el.innerHTML = renderQuestDetail(state, todayISO, openId);
    else el.innerHTML = renderGrid(state, todayISO);
    wireEvents(el, state);
    if (mode === "room" || mode === "quest") {
      var pathEl = el.querySelector(".path");
      // Fonts/webfont swap can still reflow text after this fires once, so
      // draw on the next frame (post-layout) and once more shortly after.
      requestAnimationFrame(function () { drawTrail(pathEl); });
      setTimeout(function () { drawTrail(pathEl); }, 300);
    }
  }

  window.addEventListener("resize", function () {
    if (mode !== "room" && mode !== "quest") return;
    drawTrail(document.querySelector("#view-dnes .path"));
  });

  function wireEvents(el, state) {
    if (mode === "grid") {
      var deckEl = document.getElementById("deck");
      if (deckEl) {
        var cards = deckEl.querySelectorAll(".pcard");
        applyDeckSizes(cards, selectedDeckIdx);
        cards.forEach(function (c, i) {
          c.addEventListener("click", function () {
            // Tapping the already-expanded card opens it; tapping any other
            // card just brings it to the front (check BEFORE mutating classes).
            if (c.classList.contains("d0")) { openDeckItem(c); return; }
            selectedDeckIdx = i;
            applyDeckSizes(cards, i);
            c.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
          });
        });
      }
      el.querySelectorAll(".check").forEach(function (btn) {
        btn.addEventListener("click", function () { toggleSimple(btn.dataset.kind, btn.dataset.id); });
      });
    } else {
      var back = document.getElementById("back-btn");
      if (back) back.addEventListener("click", function () { mode = "grid"; openId = null; render(); });
      el.querySelectorAll(".node").forEach(function (btn) {
        btn.addEventListener("click", function () { onNodeClick(btn.dataset.nodeKind, btn.dataset.nodeId); });
      });
      var pathEl = el.querySelector(".path");
      var room = mode === "room" ? state.base.find(function (r) { return r.id === openId; }) : null;
      if (pathEl && room) wireDrag(pathEl, room);
    }
  }

  function applyDeckSizes(cards, idx) {
    cards.forEach(function (c, i) {
      c.classList.remove("d0", "d1");
      var dist = Math.abs(i - idx);
      if (dist === 0) c.classList.add("d0");
      else if (dist === 1) c.classList.add("d1");
    });
  }

  function openDeckItem(c) {
    if (c.dataset.kind === "room") { mode = "room"; openId = c.dataset.id; }
    else { mode = "quest"; openId = c.dataset.id; }
    render();
  }

  function toggleSimple(kind, taskId) {
    var state = window.RozStore.state;
    var todayISO = D.todayISO();
    var idx = state.completions.findIndex(function (c) { return c.kind === kind && c.taskId === taskId && c.date === todayISO; });
    if (idx > -1) state.completions.splice(idx, 1);
    else state.completions.push({ id: window.RozStore.uid("c"), kind: kind, taskId: taskId, date: todayISO, actualMin: null });
    window.RozStore.save("toggle");
    render();
  }

  function onNodeClick(kind, taskId) {
    var state = window.RozStore.state;
    var todayISO = D.todayISO();
    var key = timerKey(kind, taskId);
    var already = state.completions.findIndex(function (c) { return c.kind === kind && c.taskId === taskId && c.date === todayISO; });
    if (already > -1) {
      // undo a completed task
      state.completions.splice(already, 1);
      delete timers[key];
      window.RozStore.save("undo");
      render();
      return;
    }
    var t = timers[key];
    if (t && t.running) {
      var actualMin = Math.round(t.elapsedSec / 60);
      delete timers[key];
      state.completions.push({ id: window.RozStore.uid("c"), kind: kind, taskId: taskId, date: todayISO, actualMin: actualMin });
      window.RozStore.save("complete");
      render();
    } else {
      timers[key] = { running: true, elapsedSec: 0 };
      ensureTicking();
      render();
    }
  }

  function ensureTicking() {
    if (tickInterval) return;
    tickInterval = setInterval(function () {
      var any = false;
      Object.keys(timers).forEach(function (k) { if (timers[k].running) { timers[k].elapsedSec++; any = true; } });
      if (any) updateRunningDisplays();
    }, 1000);
  }

  function updateRunningDisplays() {
    Object.keys(timers).forEach(function (k) {
      if (!timers[k].running) return;
      var elSpan = document.querySelector('[data-timer-live="' + k.replace(/"/g, '\\"') + '"]');
      if (elSpan) elSpan.textContent = mmss(timers[k].elapsedSec);
    });
  }

  // Touch-friendly reorder: lift on the handle, follow the finger vertically,
  // drop to reorder. Deliberately reflows only on release (not live during
  // the drag) — far more robust on a touchscreen than trying to keep the
  // whole array/DOM in sync every pointermove.
  function wireDrag(pathEl, room) {
    var dragging = null;
    pathEl.querySelectorAll(".draghandle").forEach(function (handle) {
      handle.addEventListener("pointerdown", function (e) {
        var stopEl = handle.closest(".stop");
        dragging = { taskId: handle.dataset.dragId, stopEl: stopEl, pointerId: e.pointerId, startY: e.clientY };
        stopEl.style.zIndex = "5";
        stopEl.style.transition = "none";
        try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      });
    });
    pathEl.addEventListener("pointermove", function (e) {
      if (!dragging || e.pointerId !== dragging.pointerId) return;
      dragging.stopEl.style.transform = "translateY(" + (e.clientY - dragging.startY) + "px)";
    });
    function endDrag(e) {
      if (!dragging || (e && e.pointerId !== dragging.pointerId)) return;
      var stops = Array.prototype.slice.call(pathEl.querySelectorAll(".stop"));
      var fromIdx = stops.findIndex(function (s) { return s === dragging.stopEl; });
      var dropY = e ? e.clientY : dragging.startY;
      var toIdx = fromIdx, minD = Infinity;
      stops.forEach(function (s, i) {
        var r = s.getBoundingClientRect();
        var d = Math.abs((r.top + r.height / 2) - dropY);
        if (d < minD) { minD = d; toIdx = i; }
      });
      dragging.stopEl.style.transform = "";
      dragging.stopEl.style.zIndex = "";
      if (toIdx !== fromIdx) {
        var targetTaskId = stops[toIdx] ? stops[toIdx].dataset.id : null;
        reorderRoomTask(room, dragging.taskId, targetTaskId);
      }
      dragging = null;
      render();
    }
    pathEl.addEventListener("pointerup", endDrag);
    pathEl.addEventListener("pointercancel", endDrag);
  }

  function reorderRoomTask(room, taskId, targetTaskId) {
    var fromIdx = room.tasks.findIndex(function (t) { return t.id === taskId; });
    if (fromIdx < 0) return;
    var moved = room.tasks.splice(fromIdx, 1)[0];
    var targetIdx = targetTaskId ? room.tasks.findIndex(function (t) { return t.id === targetTaskId; }) : -1;
    if (targetIdx < 0) room.tasks.push(moved);
    else room.tasks.splice(targetIdx, 0, moved);
    window.RozStore.save("reorder");
  }

  window.RozViewDnes = { render: render };
})();
