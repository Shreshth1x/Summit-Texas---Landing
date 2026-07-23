/* ============================================================
   silicon hills project — interactions
   One fixed viewport, three stacked views (hero / summit / mission).
   The mission button plays a single master GSAP timeline that
   hands hero -> SUMMIT -> mission. BACK crossfades home. No scroll.
   ============================================================ */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Reveal the settled hero with no animation (no-GSAP fallback). */
  function revealStaticNoGsap() {
    var hero = document.querySelector(".hero");
    if (hero) hero.classList.remove("is--hidden");
    document
      .querySelectorAll("[data-hero-fade], .hero__cta, .sticker-item")
      .forEach(function (el) { el.style.opacity = "1"; });
    document.body.classList.remove("is--loading");
  }

  /* If GSAP failed to load, degrade gracefully to a static hero. */
  if (typeof window.gsap === "undefined") {
    revealStaticNoGsap();
    return;
  }

  gsap.registerPlugin(SplitText, Draggable);

  /* Shared element references + animation state. */
  var hero, mesaView, manifestoView, stage, word, horizon, mLabel,
    learnBtn, backLink, split, chars, heroBits, mFadeTargets;
  var isAnimating = false;

  function riseFrom() { return window.innerHeight * 0.6; }   // +60vh below
  function liftTo() { return -window.innerHeight * 0.7; }    // -70vh above

  /* ----------------------------------------------------------
     Draggable sticker (summit mark) — the persistent overlay.
     ---------------------------------------------------------- */
  function initDraggableSticker() {
    var wrapper = document.querySelector('[data-sticker="wrap"]');
    var sticker = document.querySelector('[data-sticker="item"]');
    if (!wrapper || !sticker) return;

    Draggable.create(sticker, {
      bounds: wrapper,
      dragResistance: 0.05,
      onPress: function () {
        gsap.to(this.target, {
          scale: 1.15,
          rotation: gsap.utils.random(-15, 15),
          filter: "drop-shadow(0px 8px 12px rgba(0,0,0,0.15))",
          duration: 0.15,
          ease: "power2.out"
        });
      },
      onRelease: function () {
        gsap.to(this.target, {
          scale: 1,
          rotation: 0,
          filter: "drop-shadow(0px 0px 0px rgba(0,0,0,0))",
          duration: 0.3,
          ease: "back.out(2)"
        });
      }
    });
  }

  /* ----------------------------------------------------------
     Start-state setters — called before every (re)play so nothing
     is ever left half-animated.
     ---------------------------------------------------------- */
  function setMesaStart() {
    gsap.set(mesaView, { autoAlpha: 0 });
    gsap.set(stage, { y: 0, autoAlpha: 1 });
    if (chars) gsap.set(chars, { y: riseFrom, autoAlpha: 0 });
    gsap.set(horizon, { scaleX: 0 });
    gsap.set(mLabel, { autoAlpha: 0, y: 12 });
  }

  function setManifestoStart() {
    gsap.set(manifestoView, { autoAlpha: 0 });
    gsap.set(mFadeTargets, { autoAlpha: 0, y: 24 });
  }

  /* ----------------------------------------------------------
     Our Mission — the master timeline (hero -> SUMMIT -> mission).
     ---------------------------------------------------------- */
  function playForward() {
    if (isAnimating) return;
    isAnimating = true;
    learnBtn.disabled = true;

    if (reduceMotion) { reducedForward(); return; }

    setMesaStart();
    setManifestoStart();

    var tl = gsap.timeline({
      onComplete: function () { isAnimating = false; }
    });

    // a. Hero content fades out + drifts up.
    tl.to(heroBits, {
      y: -30, autoAlpha: 0, duration: 0.5, ease: "power2.in", stagger: 0.06
    }, 0);
    tl.set(hero, { autoAlpha: 0 }, 0.9);

    // b. Summit appears; S, U, M, M, I, T rise from below one by one.
    tl.set(mesaView, { autoAlpha: 1 }, 0.35);
    tl.to(chars, {
      y: 0, autoAlpha: 1, duration: 0.9, ease: "expo.out", stagger: 0.15
    }, 0.4);
    tl.to(horizon, { scaleX: 1, duration: 0.6, ease: "power2.out" }, 1.45);
    tl.to(mLabel, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" }, 1.6);

    // c. Hold the assembled word (~0.7s gap before the lift).

    // d. The whole stage lifts up and out, fading at the tail.
    tl.to(stage, { y: liftTo, duration: 1.0, ease: "power3.inOut" }, 2.75);
    tl.to(stage, { autoAlpha: 0, duration: 0.35, ease: "power1.in" }, 3.4);
    tl.set(mesaView, { autoAlpha: 0 }, 3.75);

    // e. Manifesto fades in with the staggered 24px entrance.
    tl.set(manifestoView, { autoAlpha: 1 }, 3.6);
    tl.to(mFadeTargets, {
      y: 0, autoAlpha: 1, duration: 0.7, ease: "power2.out", stagger: 0.1
    }, 3.65);
  }

  /* Reduced motion — plain crossfade hero -> mission, skip SUMMIT. */
  function reducedForward() {
    setManifestoStart();
    gsap.set(mFadeTargets, { autoAlpha: 1, y: 0 }); // no stagger; show at once
    var tl = gsap.timeline({ onComplete: function () { isAnimating = false; } });
    tl.to(hero, { autoAlpha: 0, duration: 0.4, ease: "power1.inOut" }, 0);
    tl.to(manifestoView, { autoAlpha: 1, duration: 0.4, ease: "power1.inOut" }, 0);
  }

  /* ----------------------------------------------------------
     BACK — crossfade to the settled hero, no replay of SUMMIT/intro.
     ---------------------------------------------------------- */
  function goBack() {
    if (isAnimating) return;
    isAnimating = true;

    var dur = reduceMotion ? 0.4 : 0.6;

    // Restore hero content underneath (hero container still hidden).
    gsap.set(heroBits, { autoAlpha: 1, y: 0 });

    var tl = gsap.timeline({
      onComplete: function () {
        isAnimating = false;
        learnBtn.disabled = false;
        setMesaStart(); // reset so the next Our Mission transition is clean
      }
    });
    tl.to(manifestoView, { autoAlpha: 0, duration: dur, ease: "power2.inOut" }, 0);
    tl.to(hero, { autoAlpha: 1, duration: dur, ease: "power2.inOut" }, 0);
  }

  /* ----------------------------------------------------------
     Wire up refs, sticker, split, start states and buttons.
     ---------------------------------------------------------- */
  function initInteractive() {
    hero = document.querySelector(".hero");
    mesaView = document.querySelector(".mesa");
    manifestoView = document.querySelector(".manifesto");
    stage = document.querySelector(".mesa__stage");
    word = document.querySelector(".mesa__word");
    horizon = document.querySelector(".mesa__horizon");
    mLabel = document.querySelector(".mesa__label");
    learnBtn = document.querySelector("[data-learn-more]");
    backLink = document.querySelector("[data-manifesto-back]");

    heroBits = [
      document.querySelector(".hero__wordmark"),
      document.querySelector(".hero__sub"),
      document.querySelector(".meta"),
      document.querySelector(".copyright"),
      learnBtn
    ].filter(Boolean);

    mFadeTargets = document.querySelectorAll("[data-m-fade]");

    initDraggableSticker();

    if (word) {
      split = new SplitText(word, { type: "chars", charsClass: "mesa-char" });
      chars = split.chars;
    }

    setMesaStart();
    setManifestoStart();

    if (learnBtn) learnBtn.addEventListener("click", playForward);
    if (backLink) {
      backLink.addEventListener("click", function (e) {
        e.preventDefault();
        goBack();
      });
    }
  }

  /* ----------------------------------------------------------
     Reduced motion — settled hero on boot, then interactive.
     ---------------------------------------------------------- */
  function initReducedMotion() {
    var h = document.querySelector(".hero");
    if (h) h.classList.remove("is--hidden");
    gsap.set(
      document.querySelectorAll("[data-hero-fade], .hero__cta, .sticker-item"),
      { opacity: 1 }
    );
    document.body.classList.remove("is--loading");
    initInteractive();
  }

  /* ----------------------------------------------------------
     Crisp intro timeline (unchanged), then go interactive.
     ---------------------------------------------------------- */
  function initIntro() {
    var h = document.querySelector(".hero");
    var wordmark = document.querySelector("[data-hero-words]");
    var subline = document.querySelector("[data-hero-lines]");
    var cta = document.querySelector("[data-learn-more]");
    var fades = document.querySelectorAll("[data-hero-fade]");
    var sticker = document.querySelector('[data-sticker="item"]');

    var words = [];
    if (wordmark) {
      words = new SplitText(wordmark, { type: "words", mask: "words" }).words;
      gsap.set(words, { yPercent: 110 });
    }

    var lines = [];
    if (subline) {
      lines = new SplitText(subline, { type: "lines", mask: "lines", linesClass: "line" }).lines;
      gsap.set(lines, { yPercent: 110 });
    }

    if (cta) gsap.set(cta, { y: 12 });

    var tl = gsap.timeline({
      defaults: { ease: "expo.out" },
      onStart: function () {
        if (h) h.classList.remove("is--hidden");
      },
      onComplete: function () {
        document.body.classList.remove("is--loading");
        initInteractive();
      }
    });

    // a. wordmark pops up after a short beat
    if (words.length) {
      tl.to(words, { yPercent: 0, duration: 1.1, stagger: 0.08 }, 0.3);
    }

    // b. sub-line masked line reveal
    if (lines.length) {
      tl.to(lines, { yPercent: 0, duration: 0.9, stagger: 0.1 }, "-=0.55");
    }

    // c. CTA fades up 12px below the sub-line
    if (cta) {
      tl.to(cta, { opacity: 1, y: 0, duration: 0.6 }, "-=0.5");
    }

    // d. meta, CTA button and sticker fade in together
    var fadeTargets = Array.prototype.slice.call(fades);
    if (sticker) fadeTargets.push(sticker);
    if (fadeTargets.length) {
      tl.to(fadeTargets, { opacity: 1, duration: 0.6 }, "-=0.4");
    }
  }

  /* ----------------------------------------------------------
     Deep link — arrive straight at the settled manifesto
     (from the support/contact "← BACK" links → /#manifesto).
     Skips the intro + SUMMIT; the hero waits settled but hidden
     underneath so its own [ BACK ] and an Our Mission replay work.
     ---------------------------------------------------------- */
  function showManifestoDirect() {
    var h = document.querySelector(".hero");
    if (h) h.classList.remove("is--hidden");
    // Settle the hero underneath so a later BACK reveals it cleanly.
    gsap.set(
      document.querySelectorAll("[data-hero-fade], .hero__cta, .sticker-item"),
      { opacity: 1 }
    );
    document.body.classList.remove("is--loading");

    initInteractive();

    // Hero hidden; manifesto shown in its "arrived" state.
    gsap.set(hero, { autoAlpha: 0 });
    if (learnBtn) learnBtn.disabled = true;
    gsap.set(manifestoView, { autoAlpha: 1 });

    if (reduceMotion) {
      gsap.set(mFadeTargets, { autoAlpha: 1, y: 0 });
    } else {
      isAnimating = true;
      gsap.set(mFadeTargets, { autoAlpha: 0, y: 24 });
      gsap.to(mFadeTargets, {
        autoAlpha: 1, y: 0, duration: 0.7, ease: "power2.out", stagger: 0.1,
        onComplete: function () { isAnimating = false; }
      });
    }

    // Drop the hash so the hero <-> manifesto cycle has no stale state.
    if (window.history && window.history.replaceState) {
      window.history.replaceState(
        null, "", window.location.pathname + window.location.search
      );
    }
  }

  /* ----------------------------------------------------------
     Boot — wait for fonts so SplitText measures correctly.
     ---------------------------------------------------------- */
  function boot() {
    if (window.location.hash === "#manifesto") {
      showManifestoDirect();
    } else if (reduceMotion) {
      initReducedMotion();
    } else {
      initIntro();
    }
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(boot);
  } else {
    boot();
  }
})();
