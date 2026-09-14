(() => {
  'use strict';

  const total = document.querySelector('[data-donate-total]');
  const count = document.querySelector('[data-donate-count]');
  const list = document.querySelector('[data-donate-list]');
  const status = document.querySelector('[data-donate-status]');
  const empty = document.querySelector('[data-donate-empty]');
  const thanks = document.querySelector('[data-donate-thanks]');
  if (!total || !count || !list || !status || !empty) return;

  if (thanks && new URLSearchParams(window.location.search).get('thanks') === '1') {
    thanks.hidden = false;
  }

  const money = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  const number = new Intl.NumberFormat('en-US');
  let inFlight = false;
  let pollTimer;
  let lastRendered;

  function isAmount(value) {
    return Number.isSafeInteger(value) && value >= 0;
  }

  function validate(data) {
    if (!data || data.currency !== 'usd' || !isAmount(data.totalAmount)
      || !isAmount(data.contributionCount) || !Array.isArray(data.contributions)) {
      throw new Error('Invalid donation totals');
    }

    for (const contribution of data.contributions) {
      if (!contribution || typeof contribution.name !== 'string'
        || !contribution.name.trim() || !isAmount(contribution.amount)
        || contribution.amount === 0 || typeof contribution.date !== 'string'
        || !/^\d{4}-\d{2}-\d{2}$/.test(contribution.date)) {
        throw new Error('Invalid contribution');
      }
      const timestamp = Date.parse(`${contribution.date}T12:00:00Z`);
      if (!Number.isFinite(timestamp)
        || new Date(timestamp).toISOString().slice(0, 10) !== contribution.date) {
        throw new Error('Invalid contribution date');
      }
    }

    return data;
  }

  function render(data) {
    const signature = JSON.stringify([data.totalAmount, data.contributionCount, data.contributions]);
    if (signature === lastRendered) return;

    const rows = document.createDocumentFragment();
    for (const contribution of data.contributions) {
      const row = document.createElement('li');
      row.className = 'donate-chip';
      const name = document.createElement('span');
      name.className = 'donate-chip__name';
      name.textContent = contribution.name;
      const amount = document.createElement('span');
      amount.className = 'donate-chip__amount';
      amount.textContent = money.format(contribution.amount / 100);
      row.append(name, amount);
      rows.append(row);
    }

    total.textContent = money.format(data.totalAmount / 100);
    count.textContent = `${number.format(data.contributionCount)} ${data.contributionCount === 1 ? 'contribution' : 'contributions'}`;
    list.replaceChildren(rows);
    empty.hidden = data.contributionCount !== 0;
    lastRendered = signature;
  }

  function scheduleNext() {
    window.clearTimeout(pollTimer);
    if (!document.hidden) pollTimer = window.setTimeout(refresh, 10000);
  }

  async function refresh() {
    if (inFlight || document.hidden) return;
    inFlight = true;
    window.clearTimeout(pollTimer);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch('/api/donations', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Donation totals unavailable');
      render(validate(await response.json()));
      status.textContent = '';
    } catch {
      const message = lastRendered
        ? 'Donation totals are temporarily unavailable. Showing the last update.'
        : 'Donation totals are temporarily unavailable.';
      if (status.textContent !== message) status.textContent = message;
    } finally {
      window.clearTimeout(timeout);
      list.setAttribute('aria-busy', 'false');
      inFlight = false;
      scheduleNext();
    }
  }

  document.addEventListener('visibilitychange', () => {
    window.clearTimeout(pollTimer);
    if (!document.hidden) refresh();
  });
  // Checkout can return through browser history or another window without a
  // visibility change. Refresh immediately while coalescing overlapping events.
  window.addEventListener('pageshow', refresh);
  window.addEventListener('focus', refresh);

  refresh();
})();
