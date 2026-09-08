// Pure derivation: what's due today, streak, and calendar day status.
// Reads RozStore.state + RozDates; never mutates.
(function () {
  "use strict";

  var D = window.RozDates;

  function isOneOff(freqText) {
    return /jednorázov|jednorazov|jednou|1x/i.test(freqText || "");
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

  // Build the id set of base tasks currently overridden by an active quest's "modified" entry.
  function modifiedBaseIds(state) {
    var ids = {};
    activeQuests(state).forEach(function (q) {
      (q.modified || []).forEach(function (m) { if (m.baseTaskId) ids[m.baseTaskId] = q.id; });
    });
    return ids;
  }

  function computeTodayView(state, todayISO) {
    var week = D.isoWeekBounds(todayISO);
    var quarter = D.quarterBounds(todayISO);
    var overridden = modifiedBaseIds(state);

    var daily = [], weekly = [], quarterly = [], asNeeded = [];
    var roomName;

    state.base.forEach(function (room) {
      room.tasks.forEach(function (t) {
        if (overridden[t.id]) return; // replaced by a quest's modified task below
        var row = { id: t.id, kind: "base", name: t.name, min: t.min, room: room.name, done: false };
        if (t.freq === "denne") {
          row.done = doneOn(state, "base", t.id, todayISO);
          daily.push(row);
        } else if (t.freq === "tydne") {
          if (!doneInRange(state, "base", t.id, week.start, week.end)) { row.done = false; weekly.push(row); }
        } else if (t.freq === "ctvrtletne") {
          if (!doneInRange(state, "base", t.id, quarter.start, quarter.end)) { row.done = false; quarterly.push(row); }
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
        var row = {
          id: t.id, kind: "quest-modified", name: t.name, min: t.min, quest: q.name,
          baseRef: t.baseRef || (base ? base.name : ""), done: false
        };
        if (freq === "denne") { row.done = doneOn(state, "quest-modified", t.id, todayISO); daily.push(row); }
        else if (freq === "tydne") { if (!doneInRange(state, "quest-modified", t.id, week.start, week.end)) weekly.push(row); }
        else if (freq === "ctvrtletne") { if (!doneInRange(state, "quest-modified", t.id, quarter.start, quarter.end)) quarterly.push(row); }
        else { row.done = doneOn(state, "quest-modified", t.id, todayISO); daily.push(row); }
      });
    });

    var progressList = daily.concat(weekly, quarterly, questAdded, questModified);
    var progressDone = progressList.filter(function (r) { return r.done; }).length;

    return {
      daily: daily, weekly: weekly, quarterly: quarterly, asNeeded: asNeeded,
      questAdded: questAdded, questModified: questModified,
      progressDone: progressDone, progressTotal: progressList.length
    };
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
    findRoomOf: findRoomOf
  };
})();
