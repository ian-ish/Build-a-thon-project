document.getElementById('regForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  showError('err', '');
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  try {
    const r = await apiCall('/api/register', { method: 'POST', body: {
      full_name: document.getElementById('full_name').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      designation: document.getElementById('designation').value,
      password: document.getElementById('password').value
    }});
    if (r.ok) { location.href = r.data.next || '/kyc'; return; }
    showError('err', r.data.error || 'Could not create the account.');
  } catch (ex) {
    showError('err', 'Cannot reach the server. Is it running?');
  }
  btn.disabled = false;
});
