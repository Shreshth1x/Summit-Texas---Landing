(() => {
  'use strict';

  const form = document.querySelector('#signup-form');
  const status = form?.querySelector('.form-status');
  const submit = form?.querySelector('.join-submit');
  if (!form || !status || !submit) return;
  const formInputs = [...form.querySelectorAll('input')];

  let submissionId = createSubmissionId();
  let requestStarted = false;
  const defaultSubmitLabel = 'Email my confirmation link';

  function createSubmissionId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
      const random = Math.floor(Math.random() * 16);
      const value = character === 'x' ? random : (random & 0x3) | 0x8;
      return value.toString(16);
    });
  }

  function show(message, type) {
    status.textContent = message;
    status.className = `form-status form-status--${type}`;
    status.focus();
  }

  function fieldValue(name) {
    const field = form.elements.namedItem(name);
    return field instanceof HTMLInputElement ? field.value : '';
  }

  form.addEventListener('input', () => {
    if (requestStarted && !submit.disabled) {
      submissionId = createSubmissionId();
      requestStarted = false;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';
    status.className = 'form-status';
    submit.querySelector('span')?.replaceChildren(defaultSubmitLabel);

    if (!form.reportValidity()) return;

    requestStarted = true;
    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    formInputs.forEach((input) => { input.disabled = true; });

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    const agreement = form.elements.namedItem('agreementAccepted');

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          submissionId,
          name: fieldValue('name'),
          email: fieldValue('email'),
          agreementAccepted: agreement instanceof HTMLInputElement && agreement.checked,
          website: fieldValue('website'),
          agreementVersion: form.dataset.agreementVersion,
          agreementSha256: form.dataset.agreementSha256,
          acceptanceTextSha256: form.dataset.acceptanceTextSha256
        }),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'strict-origin',
        signal: controller.signal
      });

      let responseBody = null;
      if (response.status === 409) {
        try {
          responseBody = await response.json();
        } catch {
          responseBody = null;
        }
      }
      if (response.status === 409 && responseBody?.error === 'submission_changed') {
        submissionId = createSubmissionId();
        requestStarted = false;
        show('Your details changed after an earlier request. Review them once more, then submit again.', 'error');
        return;
      }
      if (response.status === 409) {
        show('The agreement changed after this page loaded. Refresh this page, review the latest version, and accept it before trying again.', 'error');
        return;
      }
      if (!response.ok) throw new Error('request_failed');

      show('Request received. Check your inbox for a confirmation email. If it doesn’t arrive within a few minutes, check spam or contact contact@siliconhillsproject.com. The link expires after 24 hours.', 'success');
      form.reset();
      submissionId = createSubmissionId();
      requestStarted = false;
    } catch {
      show('We couldn’t send your confirmation email. Check your connection and try again, or contact contact@siliconhillsproject.com.', 'error');
    } finally {
      window.clearTimeout(timer);
      formInputs.forEach((input) => { input.disabled = false; });
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
    }
  });
})();
