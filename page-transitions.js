/* Native page crossfades; only the wood assembly has a staged departure. */
(function (root, factory) {
  'use strict';
  var create = factory();
  if (typeof module === 'object' && module.exports) module.exports = create;
  if (root && root.document) {
    // Run from the head so the fallback is defined before the first paint.
    // The browser owns same-origin transitions, including Back and Forward.
    root.document.documentElement.dataset.pageMotion =
      'CSSViewTransitionRule' in root ? 'native' : 'fade';
    var boot = function () { root.SHPPageTransitions = create(root, root.document); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  return function createPageTransitions(win, doc) {
    var preference = win.matchMedia('(prefers-reduced-motion: reduce)');
    var effects = [];
    var deadline = null;
    var restoreTimer = null;
    var pending = null;
    var epoch = 0;
    var body = doc.body;
    var hero = doc.querySelector('[data-logo-mosaic]');
    var core = doc.querySelector('[data-logo-core]');
    var state = 'idle';

    function clearEffects() {
      epoch += 1;
      effects.forEach(function (effect) { effect.cancel(); });
      effects = [];
      win.clearTimeout(deadline);
      win.clearTimeout(restoreTimer);
      deadline = restoreTimer = null;
      body.classList.remove('is-page-leaving', 'is-mission-leaving');
      state = 'idle';
    }

    function reset() {
      pending = null;
      clearEffects();
    }

    function animate(element, frames, duration, delay, easing) {
      if (!element) return;
      var effect = element.animate(frames, {
        duration: duration,
        delay: delay || 0,
        easing: easing || 'cubic-bezier(0.22, 0.3, 0.24, 1)',
        fill: 'both'
      });
      // Attach rejection handling immediately; cancellation is a normal lifecycle event.
      effect.finished.catch(function () {});
      effects.push(effect);
    }

    function commit() {
      if (!pending) return;
      var destination = pending;
      pending = null;
      win.clearTimeout(deadline);
      deadline = null;
      state = 'navigating';
      try {
        win.location.assign(destination.href);
      } finally {
        // A slow or cancelled navigation must leave a usable page behind.
        restoreTimer = win.setTimeout(reset, 1500);
      }
    }

    function separateHero() {
      var blocks = Array.from(doc.querySelectorAll('[data-block-id]'));
      // Retain the current positions on an early click, so unfinished pieces
      // turn back out without flashing into the assembled arrangement first.
      var starts = blocks.map(function (block) {
        return typeof win.getComputedStyle === 'function' ? win.getComputedStyle(block).transform : 'none';
      });
      if (win.SHPWoodLoader) win.SHPWoodLoader.finish();
      if (win.SHPWoodHover) win.SHPWoodHover.reset();
      body.classList.add('is-mission-leaving');
      var order = ['core', 'e', 'g', 'f', 'c', 'd', 'b', 'a'];
      blocks.forEach(function (block, index) {
        var rect = block.getBoundingClientRect();
        var side = block.getAttribute('data-block-side');
        var x = 0, y = 0;
        if (side === 'left') x = -rect.right - 24;
        else if (side === 'top') y = -rect.bottom - 24;
        else if (side === 'bottom') y = win.innerHeight - rect.top + 24;
        else x = win.innerWidth - rect.left + 24;
        var position = Math.max(0, order.indexOf(block.getAttribute('data-block-id')));
        var delay = position === 0 ? 0 : 40 + (position - 1) * 20;
        animate(block, [{ transform: starts[index] }, { transform: 'translate3d(' + x + 'px,' + y + 'px,0)' }], 380, delay, 'cubic-bezier(0.55, 0.05, 0.68, 0.53)');
      });
    }

    function click(event) {
      var link = event.target.closest && event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
          || link.hasAttribute('download') || link.classList.contains('skip-link')
          || (link.target && link.target.toLowerCase() !== '_self')) return;
      var destination;
      try { destination = new URL(link.href, win.location.href); } catch (_) { return; }
      var current = new URL(win.location.href);
      // Let the browser handle external sites and app handlers without delay.
      if (!['http:', 'https:'].includes(destination.protocol) || destination.origin !== current.origin) return;
      if (destination.pathname === current.pathname && destination.search === current.search) {
        if (!destination.hash) event.preventDefault();
        return;
      }
      if (preference.matches || !body.animate || doc.hidden) return;
      event.preventDefault();
      if (pending || state === 'navigating') return;
      clearEffects();
      pending = destination;
      body.classList.add('is-page-leaving');
      // Start loading immediately. Cross-document snapshots keep the current
      // page visible until the next page is ready, then blend the two in place.
      if (!hero || !core) {
        commit();
        return;
      }
      state = 'leaving';
      var run = epoch;
      // Bound the wait even when animation promises never settle.
      deadline = win.setTimeout(commit, 800);
      try {
        separateHero();
        Promise.all(effects.map(function (effect) { return effect.finished; })).then(function () {
          if (run === epoch) commit();
        }, function () {
          if (run === epoch) { var destination = pending; clearEffects(); pending = destination; commit(); }
        });
      } catch (_) {
        var destination = pending;
        clearEffects();
        pending = destination;
        commit();
      }
    }

    // Capture hero clicks before the loader's target listeners settle the blocks,
    // retaining their in-flight positions for an uninterrupted reversal.
    doc.addEventListener('click', click, Boolean(hero));
    doc.addEventListener('keydown', function (event) { if (event.key === 'Escape' && pending) commit(); });
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden && pending) commit();
    });
    win.addEventListener('pagehide', reset);
    win.addEventListener('pageshow', function (event) { if (event.persisted) reset(); });
    function motionChanged() {
      if (!preference.matches) return;
      var destination = pending;
      clearEffects();
      pending = destination;
      if (pending) commit();
    }
    if (preference.addEventListener) preference.addEventListener('change', motionChanged);
    else if (preference.addListener) preference.addListener(motionChanged);
    return { reset: reset, get state() { return state; } };
  };
});
