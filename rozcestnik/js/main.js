(function () {
  "use strict";

  var VIEWS = {
    dnes: window.RozViewDnes,
    kalendar: window.RozViewKalendar,
    questy: window.RozViewQuesty,
    nastaveni: window.RozViewNastaveni
  };

  function goTo(name) {
    if (!VIEWS[name]) name = "dnes";
    document.querySelectorAll(".view").forEach(function (v) {
      v.classList.toggle("active", v.dataset.view === name);
    });
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.classList.toggle("active", b.dataset.nav === name);
    });
    VIEWS[name].render();
    try { history.replaceState(null, "", "#" + name); } catch (e) { /* ignore */ }
  }

  document.querySelectorAll(".nav-item").forEach(function (btn) {
    btn.addEventListener("click", function () { goTo(btn.dataset.nav); });
  });

  var initial = (location.hash || "#dnes").slice(1);
  goTo(initial);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function (e) {
        console.warn("Service worker se nezaregistroval:", e);
      });
    });
  }
})();
