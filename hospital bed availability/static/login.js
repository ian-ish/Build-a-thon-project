document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  showError('err', '');
  const btn = document.getElementById('submitBtn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const r = await apiCall('/api/login', { method: 'POST', body: {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    }});
    if (r.ok) { location.href = r.data.next || '/'; return; }
    showError('err', r.data.error || 'Could not sign in.');
  } catch (ex) {
    showError('err', 'Cannot reach the server. Is it running?');
  }
  btn.disabled = false; btn.textContent = 'Sign in';
});
