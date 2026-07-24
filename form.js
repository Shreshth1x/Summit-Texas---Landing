/* ============================================================
   silicon hills project — involvement pages
   ============================================================ */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function reveal() {
    var items = document.querySelectorAll("[data-fade]");
    if (!items.length) return;

    if (typeof window.gsap !== "undefined" && !reduceMotion) {
      gsap.set(items, { autoAlpha: 0, y: 24 });
      gsap.to(items, {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        ease: "power2.out",
        stagger: 0.1
      });
      return;
    }

    Array.prototype.forEach.call(items, function (el) {
      el.style.opacity = "1";
    });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(reveal);
  } else {
    reveal();
  }
})();
