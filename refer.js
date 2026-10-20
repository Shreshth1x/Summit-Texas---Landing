(() => {
  'use strict';

  const form = document.querySelector('#refer-form');
  const status = form?.querySelector('.form-status');
  const submit = form?.querySelector('.refer-submit');
  if (!form || !status || !submit) return;
  const formInputs = [...form.querySelectorAll('input')];
  const fields = ['referrerName', 'referrerEmail', 'refereeName', 'reason', 'link', 'refereeEmail', 'refereePhone', 'website'];

  function show(message, type) {
    status.textContent = message;
    status.className = `form-status form-status--${type}`;
    status.focus();
  }

  function fieldValue(name) {
    const field = form.elements.namedItem(name);
    return field instanceof HTMLInputElement ? field.value.trim() : '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';
    status.className = 'form-status';

    if (!form.reportValidity()) return;

    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      show('Referrals aren’t open yet. Please email contact@siliconhillsproject.com instead.', 'error');
      return;
    }

    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    formInputs.forEach((input) => { input.disabled = true; });

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    const payload = Object.fromEntries(fields.map((name) => [name, fieldValue(name)]));

    try {
      // text/plain keeps this a simple request, which Apps Script accepts cross-origin.
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error('request_failed');

      show('Thank you. Your referral was received. Once it’s reviewed, we’ll email you an update on its status.', 'success');
      form.reset();
    } catch {
      show('We couldn’t submit your referral. Check your connection and try again, or email contact@siliconhillsproject.com.', 'error');
    } finally {
      window.clearTimeout(timer);
      formInputs.forEach((input) => { input.disabled = false; });
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
    }
  });
})();
