/* Shared helpers for login / register / KYC / admin pages (no inline scripts: strict CSP) */
(function () {
  const meta = document.querySelector('meta[name="csrf-token"]');
  window.CSRF = meta ? meta.content : '';

  window.apiCall = async function (path, opts) {
    opts = opts || {};
    const headers = { 'X-CSRF-Token': window.CSRF };
    let body = opts.body;
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const res = await fetch(path, {
      method: opts.method || 'GET', headers, body, credentials: 'same-origin'
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    return { ok: res.ok, status: res.status, data };
  };

  window.showError = function (id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('show', !!msg);
  };

  window.logout = async function () {
    await apiCall('/api/logout', { method: 'POST' });
    location.href = '/login';
  };
  document.querySelectorAll('[data-action="logout"]').forEach(function (b) {
    b.addEventListener('click', window.logout);
  });
})();
