// Pure derivation: due tasks (per room or overall), streak, room rotation,
// and calendar day status. Reads RozStore.state + RozDates; never mutates.
(function () {
  "use strict";

  var D = window.RozDates;

  // Rolling-window frequencies: "due" once this many days have passed since
  // the last completion (never calendar-bucketed, unlike denne/tydne/ctvrtletne
  // below, which reset on daily/ISO-week/calendar-quarter boundaries). Rolling
  // fits these better since e.g. "yearly" has no natural recurring bucket the
  // way a week or quarter does.
  var ROLLING_PERIOD_DAYS = { ctrnactidenne: 14, mesicne: 30, pololetne: 182, rocne: 365 };

  function isOneOff(freqText) {
    return /jednorázov|jednorazov|jednou|1x/i.test(freqText || "");
  }

  function activeQuests(state) {
    return state.quests.filter(function (q) { return q.active; });
  }

  function doneOn(state, kind, taskId, ymd) {
    return state.completions.some(function (c) { return c.kind === kind && c.taskId === taskId && c.date === ymd; });
  }
  function doneInRange(state, kind, taskId, start, end) {
    return state.completions.some(function (c) { return c.kind === kind && c.taskId === taskId && c.date >= start && c.date <= end; });
  }
  function everDone(state, kind, taskId) {
    return state.completions.some(function (c) { return c.kind === kind && c.taskId === taskId; });
  }
  function lastDoneDate(state, kind, taskId) {
    var last = null;
    state.completions.forEach(function (c) {
      if (c.kind === kind && c.taskId === taskId && (!last || c.date > last)) last = c.date;
    });
    return last;
  }
  function isRollingDue(state, kind, taskId, todayISO, freq) {
    var period = ROLLING_PERIOD_DAYS[freq];
    if (!period) return false;
    var last = lastDoneDate(state, kind, taskId);
    if (!last) return true;
    var days = Math.round((D.toUTCDate(todayISO) - D.toUTCDate(last)) / 86400000);
    return days >= period;
  }

  function roomColorKey(state, roomId) {
    var room = state.base.find(function (r) { return r.id === roomId; });
    return (room && room.color) || "kitchen";
  }
  function roomIcon(state, roomId) {
    var room = state.base.find(function (r) { return r.id === roomId; });
    return (room && room.icon) || "i-pokojicek";
  }

  function roomOfToday(state, todayISO) {
    if (!state.base.length) return null;
    var dow = D.toUTCDate(todayISO).getUTCDay();
    var isoDow = dow === 0 ? 6 : dow - 1;
    return state.base[isoDow % state.base.length];
  }

  function findRoomOf(state, taskId) {
    for (var i = 0; i < state.base.length; i++) {
      var r = state.base[i];
      for (var j = 0; j < r.tasks.length; j++) if (r.tasks[j].id === taskId) return r;
    }
    return null;
  }
  function findBaseTaskById(state, id) {
    if (!id) return null;
    for (var i = 0; i < state.base.length; i++) {
      var r = state.base[i];
      for (var j = 0; j < r.tasks.length; j++) if (r.tasks[j].id === id) return r.tasks[j];
    }
    return null;
  }
  function modifiedBaseIds(state) {
    var ids = {};
    activeQuests(state).forEach(function (q) { (q.modified || []).forEach(function (m) { if (m.baseTaskId) ids[m.baseTaskId] = q.id; }); });
    return ids;
  }

  function actualLabel(state, kind, taskId, ymd) {
    var c = state.completions.find(function (x) { return x.kind === kind && x.taskId === taskId && x.date === ymd; });
    return c && c.actualMin != null ? c.actualMin : null;
  }

  // One room's stops for its detail/session view: that room's daily tasks +
  // its remaining weekly/quarterly pool (+ any quest-modified task standing
  // in for one of its base tasks). Always same-room, so no color mixing.
  function roomDetailTasks(state, roomId, todayISO) {
    var week = D.isoWeekBounds(todayISO), quarter = D.quarterBounds(todayISO);
    var overridden = modifiedBaseIds(state);
    var room = state.base.find(function (r) { return r.id === roomId; });
    if (!room) return [];
    var colorKey = roomColorKey(state, roomId);
    var out = [];
    room.tasks.forEach(function (t) {
      if (overridden[t.id]) return;
      var row = { id: t.id, kind: "base", name: t.name, min: t.min, colorKey: colorKey, done: false, actual: null };
      if (t.freq === "denne") { row.done = doneOn(state, "base", t.id, todayISO); row.actual = actualLabel(state, "base", t.id, todayISO); out.push(row); }
      else if (t.freq === "tydne" && !doneInRange(state, "base", t.id, week.start, week.end)) out.push(row);
      else if (t.freq === "ctvrtletne" && !doneInRange(state, "base", t.id, quarter.start, quarter.end)) out.push(row);
      else if (ROLLING_PERIOD_DAYS[t.freq] && isRollingDue(state, "base", t.id, todayISO, t.freq)) out.push(row);
    });
    activeQuests(state).forEach(function (q) {
      (q.modified || []).forEach(function (t) {
        var base = findBaseTaskById(state, t.baseTaskId);
        if (!base || (findRoomOf(state, base.id) || {}).id !== roomId) return;
        var row = { id: t.id, kind: "quest-modified", name: t.name, min: t.min, colorKey: colorKey, done: false, actual: null, isQuest: true, quest: q.name };
        if (base.freq === "denne") { row.done = doneOn(state, "quest-modified", t.id, todayISO); row.actual = actualLabel(state, "quest-modified", t.id, todayISO); out.push(row); }
        else if (base.freq === "tydne" && !doneInRange(state, "quest-modified", t.id, week.start, week.end)) out.push(row);
        else if (base.freq === "ctvrtletne" && !doneInRange(state, "quest-modified", t.id, quarter.start, quarter.end)) out.push(row);
        else if (ROLLING_PERIOD_DAYS[base.freq] && isRollingDue(state, "quest-modified", t.id, todayISO, base.freq)) out.push(row);
      });
    });
    return out;
  }

  function roomSummary(state, roomId, todayISO) {
    var tasks = roomDetailTasks(state, roomId, todayISO);
    var remaining = tasks.filter(function (t) { return !t.done; });
    var minutes = remaining.reduce(function (n, t) { return n + (t.min || 0); }, 0);
    return { total: tasks.length, remaining: remaining.length, minutes: minutes };
  }

  // A quest's stops: its "added" tasks (one-offs hidden once ever completed)
  // plus its "modified" tasks (shown here too, in addition to the room view,
  // so the quest's own session covers everything it touches).
  function questDetailTasks(state, quest, todayISO) {
    var out = [];
    (quest.added || []).forEach(function (t) {
      if (isOneOff(t.freq) && everDone(state, "quest-added", t.id)) return;
      out.push({ id: t.id, kind: "quest-added", name: t.name, min: t.min, isQuest: true, quest: quest.name, done: doneOn(state, "quest-added", t.id, todayISO), actual: actualLabel(state, "quest-added", t.id, todayISO) });
    });
    (quest.modified || []).forEach(function (t) {
      out.push({ id: t.id, kind: "quest-modified", name: t.name, min: t.min, isQuest: true, quest: quest.name, done: doneOn(state, "quest-modified", t.id, todayISO), actual: actualLabel(state, "quest-modified", t.id, todayISO) });
    });
    return out;
  }

  function questSummary(state, quest, todayISO) {
    var tasks = questDetailTasks(state, quest, todayISO);
    var remaining = tasks.filter(function (t) { return !t.done; });
    return { total: tasks.length, remaining: remaining.length };
  }

  // Overall home-header stats: every room's remaining daily/weekly/quarterly
  // plus every active quest's remaining tasks plus "dle potřeby".
  function overallProgress(state, todayISO) {
    var done = 0, total = 0;
    state.base.forEach(function (room) {
      roomDetailTasks(state, room.id, todayISO).forEach(function (t) { total++; if (t.done) done++; });
    });
    activeQuests(state).forEach(function (q) {
      questDetailTasks(state, q, todayISO).forEach(function (t) { total++; if (t.done) done++; });
    });
    return { done: done, total: total };
  }

  function asNeededTasks(state, todayISO) {
    var out = [];
    state.base.forEach(function (room) {
      room.tasks.forEach(function (t) {
        if (t.freq === "dle_potreby") out.push({ id: t.id, kind: "base", name: t.name, min: t.min, room: room.name, done: doneOn(state, "base", t.id, todayISO) });
      });
    });
    return out;
  }

  function computeStreak(state, todayISO) {
    var dates = {};
    state.completions.forEach(function (c) { dates[c.date] = true; });
    var cursor = todayISO;
    if (!dates[cursor]) cursor = D.addDays(cursor, -1);
    var streak = 0;
    while (dates[cursor]) { streak++; cursor = D.addDays(cursor, -1); }
    return streak;
  }

  function dailyTaskIdsSnapshot(state) {
    var overridden = modifiedBaseIds(state);
    var ids = [];
    state.base.forEach(function (room) { room.tasks.forEach(function (t) { if (t.freq === "denne" && !overridden[t.id]) ids.push(t.id); }); });
    return ids;
  }
  function computeDayStatus(state, ymd) {
    var completedThatDay = state.completions.filter(function (c) { return c.date === ymd; });
    if (completedThatDay.length === 0) return "none";
    var dailyIds = dailyTaskIdsSnapshot(state);
    var doneIds = {};
    completedThatDay.forEach(function (c) { if (c.kind === "base") doneIds[c.taskId] = true; });
    var allDailyDone = dailyIds.length > 0 && dailyIds.every(function (id) { return doneIds[id]; });
    return allDailyDone ? "done-full" : "done-partial";
  }

  window.RozTodayView = {
    isOneOff: isOneOff,
    activeQuests: activeQuests,
    roomColorKey: roomColorKey,
    roomIcon: roomIcon,
    roomOfToday: roomOfToday,
    findRoomOf: findRoomOf,
    findBaseTaskById: findBaseTaskById,
    roomDetailTasks: roomDetailTasks,
    roomSummary: roomSummary,
    questDetailTasks: questDetailTasks,
    questSummary: questSummary,
    overallProgress: overallProgress,
    asNeededTasks: asNeededTasks,
    computeStreak: computeStreak,
    computeDayStatus: computeDayStatus
  };
})();
