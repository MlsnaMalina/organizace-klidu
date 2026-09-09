// Renders a <use> reference into the shared SVG sprite defined in index.html.
// Every icon in the app is a line icon (stroke, not fill) drawn this way —
// no emoji anywhere, per the approved visual spec.
(function () {
  "use strict";
  function icon(id, extraClass) {
    return '<svg class="ic' + (extraClass ? ' ' + extraClass : '') + '" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><use href="#' + id + '"/></svg>';
  }
  window.RozIcon = icon;
})();
