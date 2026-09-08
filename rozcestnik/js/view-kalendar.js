(function () {
  "use strict";

  var D = window.RozDates;
  var TV = window.RozTodayView;
  var cursorYear = null, cursorMonth0 = null; // 0-based month

  function daysInMonth(y, m0) {
    return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  }

  function ymd(y, m0, day) {
    var mm = String(m0 + 1).padStart(2, "0");
    var dd = String(day).padStart(2, "0");
    return y + "-" + mm + "-" + dd;
  }

  function render() {
    var el = document.getElementById("view-kalendar");
    var state = window.RozStore.state;
    var todayISO = D.todayISO();
    if (cursorYear === null) {
      var parts = todayISO.split("-").map(Number);
      cursorYear = parts[0]; cursorMonth0 = parts[1] - 1;
    }

    var firstOfMonth = new Date(Date.UTC(cursorYear, cursorMonth0, 1));
    var startDow = firstOfMonth.getUTCDay(); // 0=Sun
    var leading = startDow === 0 ? 6 : startDow - 1; // Monday-start offset
    var total = daysInMonth(cursorYear, cursorMonth0);

    var cells = "";
    for (var i = 0; i < leading; i++) cells += '<div class="cal-day outside"></div>';
    for (var day = 1; day <= total; day++) {
      var dateStr = ymd(cursorYear, cursorMonth0, day);
      var status = TV.computeDayStatus(state, dateStr);
      var cls = "cal-day";
      if (status !== "none") cls += " " + status;
      if (dateStr === todayISO) cls += " today";
      cells += '<div class="' + cls + '">' + day + "</div>";
    }

    var dowHtml = D.DOW_LABELS.map(function (l) { return '<div class="cal-dow">' + l + "</div>"; }).join("");

    el.innerHTML =
      '<p class="eyebrow">Přehled</p>'
      + '<h1 class="page-title">Kalendář</h1>'
      + '<p class="lede">Barva dne ukazuje, kolik denních úkolů toho dne bylo hotovo.</p>'
      + '<div class="month-nav">'
        + '<button type="button" id="cal-prev" aria-label="Předchozí měsíc">‹</button>'
        + '<span class="month-label">' + D.MONTH_LABELS[cursorMonth0] + " " + cursorYear + "</span>"
        + '<button type="button" id="cal-next" aria-label="Další měsíc">›</button>'
      + "</div>"
      + '<div class="cal-grid">' + dowHtml + cells + "</div>"
      + '<div class="cal-legend">'
        + '<span><span class="legend-dot" style="background:var(--raspberry)"></span> vše hotovo</span>'
        + '<span><span class="legend-dot" style="background:var(--raspberry-soft)"></span> částečně</span>'
        + '<span><span class="legend-dot" style="background:var(--surface)"></span> nic</span>'
      + "</div>";

    document.getElementById("cal-prev").addEventListener("click", function () { shift(-1); });
    document.getElementById("cal-next").addEventListener("click", function () { shift(1); });
  }

  function shift(delta) {
    cursorMonth0 += delta;
    if (cursorMonth0 < 0) { cursorMonth0 = 11; cursorYear--; }
    if (cursorMonth0 > 11) { cursorMonth0 = 0; cursorYear++; }
    render();
  }

  window.RozViewKalendar = { render: render };
})();
