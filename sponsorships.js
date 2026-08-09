/* ============================================================
   silicon hills project — sponsorship audience switcher
   ============================================================ */

(function () {
  "use strict";

  var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-sponsor-tab]"));
  var panels = Array.prototype.slice.call(document.querySelectorAll("[data-sponsor-panel]"));

  if (!tabs.length || !panels.length) return;

  function activate(key, updateUrl) {
    if (!tabs.some(function (tab) { return tab.dataset.sponsorTab === key; })) {
      key = "vc";
    }

    tabs.forEach(function (tab) {
      var isActive = tab.dataset.sponsorTab === key;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });

    panels.forEach(function (panel) {
      panel.hidden = panel.dataset.sponsorPanel !== key;
    });

    if (updateUrl && window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "#" + key);
    }
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener("click", function () {
      activate(tab.dataset.sponsorTab, true);
    });

    tab.addEventListener("keydown", function (event) {
      var nextIndex = index;

      if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      else return;

      event.preventDefault();
      tabs[nextIndex].focus();
      activate(tabs[nextIndex].dataset.sponsorTab, true);
    });
  });

  window.addEventListener("hashchange", function () {
    activate(window.location.hash.slice(1), false);
  });

  activate(window.location.hash.slice(1) || "vc", false);
})();
