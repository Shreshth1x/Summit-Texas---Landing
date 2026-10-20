(() => {
  'use strict';

  const form = document.querySelector('#admin-login-form');
  const status = form?.querySelector('.form-status');
  if (!form || !status) return;

  const messages = {
    password: 'That password isn’t right. Try again.',
    config: 'Admin login isn’t set up yet. See tools/ADMIN.md.'
  };
  const params = new URLSearchParams(window.location.search);
  const next = form.elements.namedItem('next');
  if (next instanceof HTMLInputElement && params.get('next')) next.value = params.get('next');

  const message = messages[params.get('error')];
  if (message) {
    status.textContent = message;
    status.className = 'form-status form-status--error';
    form.querySelector('#password')?.focus();
  }
})();
