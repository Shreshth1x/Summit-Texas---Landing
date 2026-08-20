/* ============================================================
   Silicon Hills Project — historical manifesto cascade
   ============================================================ */

(function () {
  "use strict";

  var body = document.body;
  var targets = Array.from(document.querySelectorAll("[data-m-fade]"));
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function revealStatic() {
    targets.forEach(function (target) {
      target.style.removeProperty("opacity");
      target.style.removeProperty("visibility");
      target.style.removeProperty("transform");
    });
    body.classList.remove("is-reveal-pending");
  }

  function revealManifesto() {
    if (reduceMotion || typeof window.gsap === "undefined" || targets.length === 0) {
      revealStatic();
      return;
    }

    window.gsap.set(targets, { autoAlpha: 0, y: 24 });
    body.classList.remove("is-reveal-pending");
    window.gsap.to(targets, {
      autoAlpha: 1,
      y: 0,
      duration: 0.7,
      ease: "power2.out",
      stagger: 0.1
    });
  }

  var fontReady = document.fonts && document.fonts.ready
    ? Promise.race([
      document.fonts.ready,
      new Promise(function (resolve) { window.setTimeout(resolve, 600); })
    ])
    : Promise.resolve();

  fontReady.then(revealManifesto, revealStatic);
})();
