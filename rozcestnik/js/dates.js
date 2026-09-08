// Date helpers. All scheduling math happens on a "YYYY-MM-DD" string already
// resolved to Europe/Prague — never re-interpreted through a local Date afterwards.
(function () {
  "use strict";

  function todayISO() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
  }

  function toUTCDate(ymd) {
    var parts = ymd.split("-").map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  }

  function toISO(d) {
    return d.toISOString().slice(0, 10);
  }

  function addDays(ymd, n) {
    var d = toUTCDate(ymd);
    d.setUTCDate(d.getUTCDate() + n);
    return toISO(d);
  }

  function isoWeekBounds(ymd) {
    var d = toUTCDate(ymd);
    var dow = d.getUTCDay(); // 0=Sun..6=Sat
    var isoDow = dow === 0 ? 7 : dow; // 1=Mon..7=Sun
    var start = new Date(d); start.setUTCDate(d.getUTCDate() - (isoDow - 1));
    var end = new Date(start); end.setUTCDate(start.getUTCDate() + 6);
    return { start: toISO(start), end: toISO(end) };
  }

  function quarterBounds(ymd) {
    var parts = ymd.split("-").map(Number);
    var y = parts[0], m = parts[1];
    var qStartMonth0 = Math.floor((m - 1) / 3) * 3;
    var start = new Date(Date.UTC(y, qStartMonth0, 1));
    var end = new Date(Date.UTC(y, qStartMonth0 + 3, 0));
    return { start: toISO(start), end: toISO(end) };
  }

  function inRange(ymd, start, end) {
    return ymd >= start && ymd <= end;
  }

  var DOW_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];
  var MONTH_LABELS = ["leden", "únor", "březen", "duben", "květen", "červen",
    "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];

  function formatCzech(ymd) {
    var parts = ymd.split("-").map(Number);
    return parts[2] + ". " + parts[1] + ". " + parts[0];
  }

  window.RozDates = {
    todayISO: todayISO,
    addDays: addDays,
    isoWeekBounds: isoWeekBounds,
    quarterBounds: quarterBounds,
    inRange: inRange,
    formatCzech: formatCzech,
    DOW_LABELS: DOW_LABELS,
    MONTH_LABELS: MONTH_LABELS,
    toUTCDate: toUTCDate,
    toISO: toISO
  };
})();
