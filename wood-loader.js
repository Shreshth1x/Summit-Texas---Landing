(function (root, factory) {
  'use strict';
  var helpers = factory();
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  if (root && root.document) {
    root.SHPWoodLoader = helpers.createWoodLoader(root, root.document);
    root.SHPWoodLoader.start();
  }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var WOOD_SOURCE = '/assets/wood-grain.webp';
  var ENTRY_GAP = 48;
  // Every piece shares one motion and cadence, including the final logo block.
  var BLOCK_SEQUENCE = [
    { id: 'a', side: 'left' },
    { id: 'b', side: 'right' },
    { id: 'd', side: 'left' },
    { id: 'c', side: 'right' },
    { id: 'f', side: 'right' },
    { id: 'g', side: 'bottom' },
    { id: 'e', side: 'left' },
    { id: 'core', side: 'right' }
  ].map(function (block, index) {
    return { id: block.id, side: block.side, delay: 40 + index * 150, duration: 700 };
  });

  // Translate an intact rectangle beyond the viewport, including a shadow gap.
  // Bounds are its final layout bounds, measured before any effect is created.
  function entryOffset(rect, side, viewport, gap) {
    var margin = gap == null ? ENTRY_GAP : gap;
    if (!rect || !viewport || ![rect.left, rect.top, rect.right, rect.bottom, viewport.width, viewport.height, margin].every(Number.isFinite)
      || rect.right <= rect.left || rect.bottom <= rect.top || viewport.width <= 0 || viewport.height <= 0 || margin < 0) {
      throw new Error('Invalid assembly geometry');
    }
    if (side === 'left') return { x: -rect.right - margin, y: 0 };
    if (side === 'right') return { x: viewport.width - rect.left + margin, y: 0 };
    if (side === 'bottom') return { x: 0, y: viewport.height - rect.top + margin };
    if (side === 'top') return { x: 0, y: -rect.bottom - margin };
    throw new Error('Invalid block entry side');
  }

  function createWoodLoader(win, doc) {
    var state = 'pending';
    var started = false;
    var epoch = 0;
    var motionEpoch = 0;
    var animations = [];
    var cleanups = [];
    var watchdog = null;
    var assetTimer = null;
    var resizeTimer = null;
    var releasePreflight = null;
    var releaseVisibility = null;
    var body = doc.body;

    function listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      cleanups.push(function () { target.removeEventListener(type, handler, options); });
    }

    function clearRecovery() {
      if (win.__shpWoodIntroRecoveryTimer != null) {
        win.clearTimeout(win.__shpWoodIntroRecoveryTimer);
        win.__shpWoodIntroRecoveryTimer = null;
      }
      if (typeof win.__shpWoodIntroRecoveryCleanup === 'function') {
        win.__shpWoodIntroRecoveryCleanup();
        win.__shpWoodIntroRecoveryCleanup = null;
      }
    }

    function finish() {
      epoch += 1;
      motionEpoch += 1;
      state = 'settled';
      if (releasePreflight) releasePreflight(false);
      if (releaseVisibility) releaseVisibility(false);
      win.clearTimeout(watchdog);
      win.clearTimeout(assetTimer);
      win.clearTimeout(resizeTimer);
      watchdog = assetTimer = resizeTimer = null;
      clearRecovery();
      cleanups.splice(0).forEach(function (cleanup) {
        try { cleanup(); } catch (_) { /* Final content must stay available. */ }
      });
      animations.splice(0).forEach(function (animation) {
        try { animation.cancel(); } catch (_) { /* CSS supplies the final layout. */ }
      });
      // Effects never mutate inline styles; cancellation restores the assembled DOM.
      if (body) {
        body.classList.remove('wood-intro-pending', 'wood-intro-running');
        body.dataset.woodState = 'settled';
      }
    }

    function preflight(runEpoch) {
      return new Promise(function (resolve) {
        var released = false;
        function release(ready) {
          if (released) return;
          released = true;
          win.clearTimeout(assetTimer);
          assetTimer = null;
          releasePreflight = null;
          resolve(Boolean(ready && runEpoch === epoch && state !== 'settled'));
        }
        releasePreflight = release;
        // The texture has solid-color CSS fallbacks, so decode failures must not
        // cancel the motion. Preflight only gives the image a short head start.
        function ready() { release(true); }
        try {
          var woodImage = new win.Image();
          listen(woodImage, 'error', ready, { once: true });
          assetTimer = win.setTimeout(function () { release(true); }, 300);
          if (typeof woodImage.decode === 'function') {
            woodImage.src = WOOD_SOURCE;
            Promise.resolve(woodImage.decode()).then(ready, ready);
          } else {
            listen(woodImage, 'load', ready, { once: true });
            woodImage.src = WOOD_SOURCE;
          }
        } catch (_) { ready(); }
      });
    }

    function whenVisible(runEpoch) {
      return new Promise(function (resolve) {
        if (!doc.hidden) {
          resolve(runEpoch === epoch && state !== 'settled');
          return;
        }
        var released = false;
        function release(visible) {
          if (released) return;
          released = true;
          doc.removeEventListener('visibilitychange', onVisibility);
          if (releaseVisibility === release) releaseVisibility = null;
          resolve(Boolean(visible && runEpoch === epoch && state !== 'settled'));
        }
        function onVisibility() {
          if (!doc.hidden) release(true);
        }
        releaseVisibility = release;
        listen(doc, 'visibilitychange', onVisibility);
      });
    }

    function assemble(blocks, runEpoch) {
      var motionRun = ++motionEpoch;
      // Hide the final layout while stale effects are released and fresh entry
      // geometry is sampled, including after a real viewport/orientation change.
      body.classList.add('wood-intro-pending', 'wood-intro-running');
      animations.splice(0).forEach(function (animation) {
        try { animation.cancel(); } catch (_) { /* The new effects take ownership. */ }
      });
      var viewport = { width: win.innerWidth, height: win.innerHeight };
      // Batch all layout reads before creating a transform on any block.
      var measured = blocks.map(function (block) {
        return {
          element: block.element,
          timing: block.timing,
          offset: entryOffset(block.element.getBoundingClientRect(), block.side, viewport)
        };
      });
      var currentAnimations = measured.map(function (block) {
        var animation = block.element.animate([
          { transform: 'translate3d(' + block.offset.x + 'px, ' + block.offset.y + 'px, 0px)' },
          { transform: 'translate3d(0px, 0px, 0px)' }
        ], {
          delay: block.timing.delay,
          duration: block.timing.duration,
          easing: 'cubic-bezier(0.22, 0.75, 0.25, 1)',
          fill: 'both'
        });
        animations.push(animation);
        animation.finished.catch(function () {});
        animation.currentTime = 0;
        return animation;
      });
      state = 'assembling';
      body.dataset.woodState = 'assembling';
      body.classList.remove('wood-intro-pending');
      win.clearTimeout(watchdog);
      watchdog = win.setTimeout(finish, 4000);
      Promise.all(currentAnimations.map(function (animation) { return animation.finished; })).then(function () {
        if (runEpoch === epoch && motionRun === motionEpoch && state === 'assembling') finish();
      }, function () {
        if (runEpoch === epoch && motionRun === motionEpoch && state !== 'settled') finish();
      });
    }

    async function start() {
      if (started || state === 'settled') return;
      started = true;
      var runEpoch = ++epoch;
      try {
        var reduced = typeof win.matchMedia === 'function'
          ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
        if (!body || win.__shpWoodIntroRequested !== true || (reduced && reduced.matches)
          || typeof win.getComputedStyle !== 'function'
          || win.getComputedStyle(body).getPropertyValue('--wood-loader-ready').trim() !== '1') {
          finish();
          return;
        }
        var mosaic = doc.querySelector('[data-logo-mosaic]');
        var elements = mosaic ? Array.from(mosaic.querySelectorAll('[data-block-id]')) : [];
        var byId = new Map();
        elements.forEach(function (element) {
          if (byId.has(element.dataset.blockId)) throw new Error('Duplicate assembly block');
          byId.set(element.dataset.blockId, element);
        });
        var blocks = BLOCK_SEQUENCE.map(function (timing) {
          var element = byId.get(timing.id);
          if (!element || typeof element.animate !== 'function') throw new Error('Assembly block unavailable');
          return { element: element, timing: timing, side: element.dataset.blockSide || timing.side };
        });
        if (elements.length !== BLOCK_SEQUENCE.length) throw new Error('Incomplete assembly');

        clearRecovery();

        // Keep blocks hidden until every backwards-filled effect owns its start.
        body.classList.add('wood-intro-pending', 'wood-intro-running');
        body.dataset.woodState = 'pending';
        blocks.forEach(function (block) {
          listen(block.element, 'click', finish, true);
          listen(block.element, 'focusin', function () {
            // Keyboard users need a stable target. Pointer focus comes before
            // click, so preserve the moving pose for the departure controller.
            try {
              if (typeof block.element.matches === 'function' && !block.element.matches(':focus-visible')) return;
            } catch (_) { /* Older selector engines receive the stable layout. */ }
            finish();
          }, true);
        });
        listen(doc, 'keydown', function (event) { if (event.key === 'Escape') finish(); });
        listen(win, 'pagehide', finish);
        listen(win, 'pageshow', function (event) { if (event.persisted) finish(); });
        if (reduced) {
          var motionChanged = function (event) { if (event.matches) finish(); };
          if (typeof reduced.addEventListener === 'function') listen(reduced, 'change', motionChanged);
          else if (typeof reduced.addListener === 'function') {
            reduced.addListener(motionChanged);
            cleanups.push(function () { reduced.removeListener(motionChanged); });
          }
        }
        var ready = await preflight(runEpoch);
        if (!ready || runEpoch !== epoch || state === 'settled') return;
        var visible = await whenVisible(runEpoch);
        if (!visible || runEpoch !== epoch || state === 'settled') return;
        if (reduced && reduced.matches) {
          finish();
          return;
        }

        var measuredWidth = win.innerWidth, measuredHeight = win.innerHeight;
        assemble(blocks, runEpoch);
        listen(doc, 'visibilitychange', function () { if (doc.hidden) finish(); });
        listen(win, 'resize', function () {
          if (win.innerWidth === measuredWidth && win.innerHeight === measuredHeight) return;
          measuredWidth = win.innerWidth;
          measuredHeight = win.innerHeight;
          win.clearTimeout(resizeTimer);
          resizeTimer = win.setTimeout(function () {
            resizeTimer = null;
            if (runEpoch !== epoch || state !== 'assembling' || doc.hidden) return;
            try { assemble(blocks, runEpoch); }
            catch (_) { if (runEpoch === epoch && state !== 'settled') finish(); }
          }, 100);
        });
      } catch (_) {
        if (runEpoch === epoch && state !== 'settled') finish();
      }
    }

    return { start: start, finish: finish, get state() { return state; } };
  }

  return { createWoodLoader: createWoodLoader, BLOCK_SEQUENCE: BLOCK_SEQUENCE, entryOffset: entryOffset, ENTRY_GAP: ENTRY_GAP };
});
