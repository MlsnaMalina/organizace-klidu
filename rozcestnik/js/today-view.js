// Pure derivation: what's due today, streak, room rotation, and calendar day status.
// Reads RozStore.state + RozDates; never mutates.
(function () {
  "use strict";

  var D = window.RozDates;
  var ROOM_COLOR_KEYS = ["a", "b", "c", "d", "e", "f"];

  function isOneOff(freqText) {
    return /jednorázov|jednorazov|jednou|1x/i.test(freqText || "");
  }

  function activeQuests(state) {
    return state.quests.filter(function (q) { return q.active; });
  }

  function completionsForTask(state, kind, taskId) {
    return state.completions.filter(function (c) { return c.kind === kind && c.taskId === taskId; });
  }

  function doneOn(state, kind, taskId, ymd) {
    return state.completions.some(function (c) { return c.kind === kind && c.taskId === taskId && c.date === ymd; });
  }

  function doneInRange(state, kind, taskId, start, end) {
    return state.completions.some(function (c) {
      return c.kind === kind && c.taskId === taskId && c.date >= start && c.date <= end;
    });
  }

  // Which CSS custom-property key (a..f, cycling) a room uses — by POSITION in
  // state.base, not by id/name, so colors stay stable-ish even as she renames rooms
  // and only reshuffle if she reorders/deletes rooms (acceptable trade-off).
  function roomColorKey(state, roomId) {
    var idx = state.base.findIndex(function (r) { return r.id === roomId; });
    if (idx < 0) idx = 0;
    return ROOM_COLOR_KEYS[idx % ROOM_COLOR_KEYS.length];
  }

  // Rotation default: one "featured" room per ISO weekday, cycling through
  // however many rooms currently exist. Purely a suggestion — the view lets
  // the user pick a different room instead.
  function roomOfToday(state, todayISO) {
    if (!state.base.length) return null;
    var dow = D.toUTCDate(todayISO).getUTCDay(); // 0=Sun..6=Sat
    var isoDow = dow === 0 ? 6 : dow - 1; // 0=Mon..6=Sun
    return state.base[isoDow % state.base.length];
  }

  function findRoomOf(state, taskId) {
    for (var i = 0; i < state.base.length; i++) {
      var r = state.base[i];
      for (var j = 0; j < r.tasks.length; j++) {
        if (r.tasks[j].id === taskId) return r;
      }
    }
    return null;
  }

  function findBaseTaskById(state, id) {
    if (!id) return null;
    for (var i = 0; i < state.base.length; i++) {
      var r = state.base[i];
      for (var j = 0; j < r.tasks.length; j++) {
        if (r.tasks[j].id === id) return r.tasks[j];
      }
    }
    return null;
  }

  // Build the id set of base tasks currently overridden by an active quest's "modified" entry.
  function modifiedBaseIds(state) {
    var ids = {};
    activeQuests(state).forEach(function (q) {
      (q.modified || []).forEach(function (m) { if (m.baseTaskId) ids[m.baseTaskId] = q.id; });
    });
    return ids;
  }

  // selectedRoomId: which room's weekly/quarterly pool counts toward today's
  // route. Daily quick tasks and "dle potřeby" stay room-agnostic (every room,
  // every day) — only the slower-cadence pool narrows to the chosen room, which
  // is what keeps "dnešní trasa" short instead of listing every room's backlog.
  function computeTodayView(state, todayISO, selectedRoomId) {
    var week = D.isoWeekBounds(todayISO);
    var quarter = D.quarterBounds(todayISO);
    var overridden = modifiedBaseIds(state);

    var daily = [], weekly = [], quarterly = [], asNeeded = [];

    state.base.forEach(function (room) {
      var colorKey = roomColorKey(state, room.id);
      room.tasks.forEach(function (t) {
        if (overridden[t.id]) return; // replaced by a quest's modified task below
        var row = { id: t.id, kind: "base", name: t.name, min: t.min, room: room.name, roomId: room.id, colorKey: colorKey, done: false };
        if (t.freq === "denne") {
          row.done = doneOn(state, "base", t.id, todayISO);
          daily.push(row);
        } else if (t.freq === "tydne") {
          if (room.id === selectedRoomId && !doneInRange(state, "base", t.id, week.start, week.end)) weekly.push(row);
        } else if (t.freq === "ctvrtletne") {
          if (room.id === selectedRoomId && !doneInRange(state, "base", t.id, quarter.start, quarter.end)) quarterly.push(row);
        } else if (t.freq === "dle_potreby") {
          row.done = doneOn(state, "base", t.id, todayISO);
          asNeeded.push(row);
        }
      });
    });

    var questAdded = [], questModified = [];
    activeQuests(state).forEach(function (q) {
      (q.added || []).forEach(function (t) {
        var oneOff = isOneOff(t.freq);
        var everDone = completionsForTask(state, "quest-added", t.id).length > 0;
        if (oneOff && everDone) return; // hide permanently once done
        questAdded.push({
          id: t.id, kind: "quest-added", name: t.name, min: t.min, quest: q.name,
          done: doneOn(state, "quest-added", t.id, todayISO)
        });
      });
      (q.modified || []).forEach(function (t) {
        var base = findBaseTaskById(state, t.baseTaskId);
        var freq = base ? base.freq : "tydne";
        var baseRoom = base ? findRoomOf(state, base.id) : null;
        var row = {
          id: t.id, kind: "quest-modified", name: t.name, min: t.min, quest: q.name,
          baseRef: t.baseRef || (base ? base.name : ""), done: false,
          roomId: baseRoom ? baseRoom.id : null, colorKey: baseRoom ? roomColorKey(state, baseRoom.id) : "a"
        };
        if (freq === "denne") { row.done = doneOn(state, "quest-modified", t.id, todayISO); daily.push(row); }
        else if (freq === "tydne") { if ((!baseRoom || baseRoom.id === selectedRoomId) && !doneInRange(state, "quest-modified", t.id, week.start, week.end)) weekly.push(row); }
        else if (freq === "ctvrtletne") { if ((!baseRoom || baseRoom.id === selectedRoomId) && !doneInRange(state, "quest-modified", t.id, quarter.start, quarter.end)) quarterly.push(row); }
        else { row.done = doneOn(state, "quest-modified", t.id, todayISO); daily.push(row); }
      });
    });

    var progressList = daily.concat(weekly, quarterly, questAdded, questModified);
    var progressDone = progressList.filter(function (r) { return r.done; }).length;
    // Timer covers only the room's WEEKLY pool — quarterly deep-cleans (often
    // 60-90+ min each) still show in the path, but shouldn't inflate a daily session.
    var sessionMinutes = weekly.reduce(function (n, r) { return n + (r.done ? 0 : (r.min || 0)); }, 0);

    return {
      daily: daily, weekly: weekly, quarterly: quarterly, asNeeded: asNeeded,
      questAdded: questAdded, questModified: questModified,
      progressDone: progressDone, progressTotal: progressList.length,
      sessionMinutes: sessionMinutes
    };
  }

  function computeStreak(state, todayISO) {
    var dates = {};
    state.completions.forEach(function (c) { dates[c.date] = true; });
    var cursor = todayISO;
    if (!dates[cursor]) cursor = D.addDays(cursor, -1);
    var streak = 0;
    while (dates[cursor]) {
      streak++;
      cursor = D.addDays(cursor, -1);
    }
    return streak;
  }

  function dailyTaskIdsSnapshot(state) {
    var overridden = modifiedBaseIds(state);
    var ids = [];
    state.base.forEach(function (room) {
      room.tasks.forEach(function (t) {
        if (t.freq === "denne" && !overridden[t.id]) ids.push(t.id);
      });
    });
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
    computeTodayView: computeTodayView,
    computeStreak: computeStreak,
    computeDayStatus: computeDayStatus,
    findBaseTaskById: findBaseTaskById,
    findRoomOf: findRoomOf,
    roomOfToday: roomOfToday,
    roomColorKey: roomColorKey
  };
})();
