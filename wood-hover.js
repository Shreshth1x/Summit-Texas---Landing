/* Pointer response for the wooden blocks; every piece opens About. */
(function () {
  'use strict';
  var mosaic = document.querySelector('[data-logo-mosaic]');
  if (!mosaic) return;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var selected = null;
  var position = null;
  var frame = null;

  function reset() {
    window.cancelAnimationFrame(frame);
    frame = null;
    position = null;
    if (!selected) return;
    selected.classList.remove('is-wood-hovered');
    ['--wood-cursor-x', '--wood-cursor-y', '--wood-tilt-x', '--wood-tilt-y'].forEach(function (property) {
      selected.style.removeProperty(property);
    });
    selected = null;
  }

  function update() {
    frame = null;
    if (!selected || !position) return;
    var rect = selected.getBoundingClientRect();
    var x = Math.max(0, Math.min(1, (position.x - rect.left) / Math.max(1, rect.width)));
    var y = Math.max(0, Math.min(1, (position.y - rect.top) / Math.max(1, rect.height)));
    selected.style.setProperty('--wood-cursor-x', (x * 100).toFixed(2) + '%');
    selected.style.setProperty('--wood-cursor-y', (y * 100).toFixed(2) + '%');
    selected.style.setProperty('--wood-tilt-x', (reduced.matches ? 0 : (0.5 - y) * 3).toFixed(2) + 'deg');
    selected.style.setProperty('--wood-tilt-y', (reduced.matches ? 0 : (x - 0.5) * 3).toFixed(2) + 'deg');
  }

  mosaic.addEventListener('pointermove', function (event) {
    if (!finePointer.matches || event.pointerType === 'touch' || document.body.dataset.woodState !== 'settled'
        || document.body.classList.contains('is-page-leaving')) return reset();
    var tile = event.target.closest('.logo-mosaic__tile[data-peel-tile]');
    if (!tile || !mosaic.contains(tile)) return reset();
    if (selected !== tile) {
      reset();
      selected = tile;
      selected.classList.add('is-wood-hovered');
    }
    position = { x: event.clientX, y: event.clientY };
    if (frame === null) frame = window.requestAnimationFrame(update);
  }, { passive: true });
  mosaic.addEventListener('pointerleave', reset);
  window.addEventListener('blur', reset);
  window.addEventListener('pagehide', reset);
  window.addEventListener('pageshow', function () {
    reset();
    document.body.toggleAttribute('data-wood-paused', document.hidden);
  });
  document.addEventListener('visibilitychange', function () {
    reset();
    document.body.toggleAttribute('data-wood-paused', document.hidden);
  });
  function preferenceChanged() { reset(); }
  [finePointer, reduced].forEach(function (preference) {
    if (preference.addEventListener) preference.addEventListener('change', preferenceChanged);
    else if (preference.addListener) preference.addListener(preferenceChanged);
  });
  document.body.toggleAttribute('data-wood-paused', document.hidden);
  window.SHPWoodHover = { reset: reset };
})();
