/* The primer decides arrival: direct visits assemble, Home links settle, reloads assemble. */
(function () {
  'use strict';

  // Keep Home's skip signal one-use; a reload of the clean URL assembles again.
  try {
    var current = new URL(window.location.href);
    if (current.searchParams.get('skip-intro') === '1') {
      current.searchParams.delete('skip-intro');
      window.history.replaceState(window.history.state, '', current.pathname + current.search + current.hash);
    }
  } catch (_) {}

  document.body.classList.remove('is-loading', 'is-home-ready');
  document.body.classList.add('is-home-settled');
  if (window.SHPWoodLoader) window.SHPWoodLoader.start();

  window.addEventListener('pageshow', function (event) {
    if (event.persisted && window.SHPWoodLoader) window.SHPWoodLoader.finish();
  });
})();
