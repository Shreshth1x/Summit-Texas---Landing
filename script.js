/* ============================================================
   Silicon Hills Project — tile build + tile-peel transition

   The mosaic constructs immediately. Its real tiles peel away on
   the way to Mission, with no separate loading interstitial.
   ============================================================ */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var resetMissionTransition = function () {};
  var resetRouteTransition = function () {};
  var resetHeaderBehavior = function () {};

  function setHomeState(shouldAnimate) {
    document.body.classList.remove(shouldAnimate ? "is-home-settled" : "is-home-ready");
    document.body.classList.add(shouldAnimate ? "is-home-ready" : "is-home-settled");
    document.body.classList.remove("is-loading");
  }

  function revealStatic() {
    setHomeState(false);
  }

  function consumeIntroSkip() {
    var shouldSkip = false;

    try {
      var currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get("skip-intro") === "1") {
        currentUrl.searchParams.delete("skip-intro");
        window.history.replaceState(null, "", currentUrl.pathname + currentUrl.search + currentUrl.hash);
        shouldSkip = true;
      }
    } catch (error) {
      /* Continue with the session fallback below. */
    }

    try {
      if (window.sessionStorage.getItem("shp:skip-intro") === "1") {
        window.sessionStorage.removeItem("shp:skip-intro");
        shouldSkip = true;
      }
    } catch (error) {
      /* Performance navigation detection remains available below. */
    }

    return shouldSkip;
  }

  function initHeaderBehavior() {
    var header = document.querySelector(".home-header");
    if (!header) return;

    var lastScrollY = window.scrollY;
    var ticking = false;

    function updateHeader() {
      var currentScrollY = Math.max(0, window.scrollY);
      var isPastRail = currentScrollY > header.offsetHeight + 16;
      var isMovingDown = currentScrollY > lastScrollY;

      header.classList.toggle("is-scrolled", currentScrollY > 8);
      header.classList.toggle("is-hidden", !reduceMotion && isPastRail && isMovingDown);

      if (currentScrollY < lastScrollY || currentScrollY <= 8) {
        header.classList.remove("is-hidden");
      }

      lastScrollY = currentScrollY;
      ticking = false;
    }

    function requestHeaderUpdate() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateHeader);
    }

    resetHeaderBehavior = function () {
      lastScrollY = Math.max(0, window.scrollY);
      header.classList.remove("is-hidden");
      header.classList.toggle("is-scrolled", lastScrollY > 8);
    };

    window.addEventListener("scroll", requestHeaderUpdate, { passive: true });
    resetHeaderBehavior();
  }

  function initNeutralTileWaves() {
    if (reduceMotion) return;

    var columns = 10;
    var rows = 6;
    var columnStep = 42;
    var jitter = [0, 28, 10, 42, 18, 34];

    Array.from(document.querySelectorAll(".logo-mosaic__pixel-wave")).forEach(function (wave) {
      if (wave.childElementCount > 0) return;

      var isReverse = wave.getAttribute("data-wave-direction") === "reverse";
      var fragment = document.createDocumentFragment();

      for (var row = 0; row < rows; row += 1) {
        for (var column = 0; column < columns; column += 1) {
          var pixel = document.createElement("span");
          var columnOrder = isReverse ? columns - 1 - column : column;
          var delay = columnOrder * columnStep + jitter[(row + column * 3) % jitter.length];

          pixel.style.setProperty("--pixel-d", delay + "ms");
          fragment.appendChild(pixel);
        }
      }

      wave.appendChild(fragment);
    });
  }

  function initRouteTransitions() {
    var progress = document.querySelector("[data-route-progress]");
    var page = document.querySelector(".home-page");

    if (reduceMotion || !progress || !page || typeof window.gsap === "undefined") {
      return;
    }

    var routeTimeline = null;
    var isNavigating = false;

    resetRouteTransition = function () {
      if (routeTimeline) {
        routeTimeline.kill();
        routeTimeline = null;
      }

      window.gsap.set(progress, { clearProps: "opacity,visibility,transform,transformOrigin" });
      window.gsap.set(page, { clearProps: "opacity,visibility,transform" });
      isNavigating = false;
    };

    Array.from(document.querySelectorAll("a[href]")).forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          link.target === "_blank" ||
          link.hasAttribute("download") ||
          link.hasAttribute("data-mission-link") ||
          link.classList.contains("skip-link")
        ) {
          return;
        }

        var destination;
        try {
          destination = new URL(link.href, window.location.href);
        } catch (error) {
          return;
        }

        if (
          destination.origin !== window.location.origin ||
          destination.pathname === window.location.pathname &&
            destination.search === window.location.search &&
            destination.hash === window.location.hash
        ) {
          return;
        }

        event.preventDefault();
        if (isNavigating) return;
        isNavigating = true;

        routeTimeline = window.gsap.timeline({
          onComplete: function () {
            window.location.assign(destination.href);
          }
        });

        routeTimeline
          .set(progress, { autoAlpha: 1, scaleX: 0, transformOrigin: "left center" }, 0)
          .to(progress, { scaleX: 1, duration: 0.52, ease: "power3.inOut" }, 0)
          .to(page, { y: -10, autoAlpha: 0, duration: 0.28, ease: "power2.in" }, 0.12);
      });
    });

    resetRouteTransition();
  }

  function initMissionTransition() {
    var mosaic = document.querySelector("[data-logo-mosaic]");
    var core = document.querySelector("[data-logo-core]");
    var tiles = Array.from(document.querySelectorAll("[data-peel-tile]"));
    var links = Array.from(document.querySelectorAll("[data-mission-link]"));
    var chrome = Array.from(document.querySelectorAll("[data-home-chrome]"));

    if (
      reduceMotion ||
      !mosaic ||
      !core ||
      tiles.length === 0 ||
      links.length === 0 ||
      typeof window.gsap === "undefined"
    ) {
      return;
    }

    var isAnimating = false;
    var transitionTimeline = null;

    function tileExit(tile) {
      var mosaicBounds = mosaic.getBoundingClientRect();
      var tileBounds = tile.getBoundingClientRect();
      var dx = tileBounds.left + tileBounds.width / 2 - (mosaicBounds.left + mosaicBounds.width / 2);
      var dy = tileBounds.top + tileBounds.height / 2 - (mosaicBounds.top + mosaicBounds.height / 2);
      var distance = Math.max(1, Math.hypot(dx, dy));
      var travel = window.innerWidth <= 560 ? 28 : 48;

      return {
        x: dx / distance * travel,
        y: dy / distance * travel,
        rotationX: dy < 0 ? 13 : -13,
        rotationY: dx < 0 ? -16 : 16
      };
    }

    resetMissionTransition = function () {
      if (transitionTimeline) {
        transitionTimeline.kill();
        transitionTimeline = null;
      }

      document.body.classList.remove("is-mission-leaving");
      window.gsap.set(tiles, {
        clearProps: "transform,opacity,visibility,filter,clipPath,transformOrigin,transformStyle"
      });
      window.gsap.set(core, {
        clearProps: "transform,opacity,visibility,filter,clipPath,transformOrigin"
      });
      if (chrome.length > 0) {
        window.gsap.set(chrome, { clearProps: "transform,opacity,visibility" });
      }
      window.gsap.set(mosaic, { clearProps: "opacity,visibility,pointerEvents,perspective" });
      links.forEach(function (link) {
        link.removeAttribute("aria-disabled");
      });
      isAnimating = false;
    };

    resetMissionTransition();

    links.forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          link.target === "_blank"
        ) {
          return;
        }

        event.preventDefault();
        if (isAnimating) return;

        isAnimating = true;
        links.forEach(function (missionLink) {
          missionLink.setAttribute("aria-disabled", "true");
        });
        document.body.classList.add("is-mission-leaving");

        var exits = tiles.map(tileExit);

        transitionTimeline = window.gsap.timeline({
          onComplete: function () {
            window.location.assign(link.href);
          }
        });

        transitionTimeline
          .set(mosaic, { pointerEvents: "none", perspective: 900 }, 0)
          .set(tiles, { transformStyle: "preserve-3d" }, 0)
          .to(tiles, {
            x: function (index) { return exits[index].x; },
            y: function (index) { return exits[index].y; },
            rotationX: function (index) { return exits[index].rotationX; },
            rotationY: function (index) { return exits[index].rotationY; },
            scale: window.innerWidth <= 560 ? 0.9 : 0.82,
            clipPath: "inset(46% 46% 46% 46%)",
            filter: window.innerWidth <= 560 ? "blur(4px)" : "blur(7px)",
            autoAlpha: 0,
            duration: 0.42,
            ease: "power2.in",
            stagger: { amount: window.innerWidth <= 560 ? 0.34 : 0.48, from: "random" }
          }, 0.08);

        if (chrome.length > 0) {
          transitionTimeline.to(chrome, {
            y: -12,
            autoAlpha: 0,
            duration: 0.3,
            ease: "power2.in",
            stagger: 0.025
          }, 0.48);
        }

        transitionTimeline
          .to(core, {
            clipPath: "inset(49% 0% 49% 0%)",
            scale: 0.985,
            autoAlpha: 0,
            duration: 0.3,
            ease: "power3.inOut"
          }, 0.56)
          .to(mosaic, { autoAlpha: 0, duration: 0.16, ease: "power1.in" }, 0.7);
      });
    });
  }

  function boot() {
    var shouldSkipIntro = consumeIntroSkip();

    initNeutralTileWaves();
    initHeaderBehavior();

    if (reduceMotion) {
      revealStatic();
      return;
    }

    initMissionTransition();
    initRouteTransitions();

    var navigation = window.performance && window.performance.getEntriesByType
      ? window.performance.getEntriesByType("navigation")[0]
      : null;

    if (shouldSkipIntro || (navigation && navigation.type === "back_forward")) {
      revealStatic();
      return;
    }

    setHomeState(true);
  }

  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      revealStatic();
      resetMissionTransition();
      resetRouteTransition();
      resetHeaderBehavior();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
